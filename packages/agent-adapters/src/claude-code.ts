// Claude Code adapter: reads ~/.claude/projects/<slug>/<sessionId>.jsonl into Universal Context Format Events.
// BUILD.md 11.1 and 11.2. Pure functions first (parse, branch selection, mapping), file access last.
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { EXTRACT_MARKER, eventId } from "@stash/core";
import type { Event, OutputExcerpt } from "@stash/context-format";
import type { AgentAdapter, CapturedSession, SessionCandidate } from "./index.js";

// ---------- raw records ----------

type Block =
  | { type: "text"; text: string }
  | { type: "thinking" | "redacted_thinking"; [k: string]: unknown }
  | { type: "image"; [k: string]: unknown }
  | { type: "tool_use"; id: string; name: string; input?: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: string | Block[]; is_error?: boolean };

export interface RawRecord {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  logicalParentUuid?: string | null;
  isSidechain?: boolean;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  sessionId?: string;
  subtype?: string;
  level?: string;
  content?: string;
  customTitle?: string;
  message?: { role?: string; content?: string | Block[] };
  /** Position in the file, added by parseJsonl. */
  line: number;
}

export type CapturedEvent = CapturedSession["events"][number];

/** Parses JSONL, skipping blank or malformed lines (a session file can be mid-write). */
export function parseJsonl(text: string): RawRecord[] {
  const out: RawRecord[] = [];
  text.split("\n").forEach((raw, line) => {
    if (!raw.trim()) return;
    try {
      const rec = JSON.parse(raw) as Omit<RawRecord, "line">;
      if (rec && typeof rec === "object" && typeof rec.type === "string") out.push({ ...rec, line });
    } catch {
      /* partial line */
    }
  });
  return out;
}

const isTurn = (r: RawRecord) => r.type === "user" || r.type === "assistant";

function blocksOf(r: RawRecord): Block[] {
  const c = r.message?.content;
  if (typeof c === "string") return [{ type: "text", text: c }];
  return Array.isArray(c) ? c : [];
}

const isToolResultRecord = (r: RawRecord) =>
  r.type === "user" && blocksOf(r).some((b) => b.type === "tool_result");

// ---------- active branch ----------

export interface Abandoned {
  /** The record on the active branch where the abandoned branch split off. */
  atUuid: string;
  records: number;
  timestamp: string | undefined;
}

export interface Branch {
  /** Records on the branch the session ended on, in file order. */
  active: RawRecord[];
  abandoned: Abandoned[];
  /** True when the history before a compaction was reconnected. */
  reconnectedCompaction: boolean;
}

/**
 * Picks the branch the session ended on. Walks parent links from the last main-thread turn, through
 * attachment and system records. Off-branch tool results are parallel tool calls and stay; any other
 * off-branch child is a rewind, recorded only as an abandoned-branch marker.
 */
export function selectActiveBranch(records: RawRecord[]): Branch {
  const byUuid = new Map<string, RawRecord>();
  for (const r of records) if (r.uuid) byUuid.set(r.uuid, r);
  const turnsInOrder = records.filter((r) => isTurn(r) && !r.isSidechain && r.uuid);
  const leaf = turnsInOrder.at(-1);
  if (!leaf) return { active: [], abandoned: [], reconnectedCompaction: false };

  let reconnectedCompaction = false;
  const parentOf = (r: RawRecord): RawRecord | undefined => {
    if (r.parentUuid) return byUuid.get(r.parentUuid);
    if (!r.logicalParentUuid) return undefined;
    const logical = byUuid.get(r.logicalParentUuid);
    if (logical) return logical;
    // The compaction's logical parent was not written to this file: join the last turn before it.
    const before = turnsInOrder.filter((t) => t.line < r.line).at(-1);
    if (before) reconnectedCompaction = true;
    return before;
  };

  const onPath = new Set<string>();
  for (let cur: RawRecord | undefined = leaf; cur?.uuid && !onPath.has(cur.uuid); cur = parentOf(cur)) {
    onPath.add(cur.uuid);
  }

  const children = new Map<string, RawRecord[]>();
  for (const r of records) {
    if (!r.uuid || !r.parentUuid) continue;
    const list = children.get(r.parentUuid) ?? [];
    list.push(r);
    children.set(r.parentUuid, list);
  }
  const subtreeTurns = (r: RawRecord): number => {
    let n = isTurn(r) ? 1 : 0;
    for (const k of children.get(r.uuid ?? "") ?? []) n += subtreeTurns(k);
    return n;
  };

  const keep = new Set(onPath);
  const abandoned: Abandoned[] = [];
  for (const uuid of onPath) {
    for (const child of children.get(uuid) ?? []) {
      if (!child.uuid || onPath.has(child.uuid) || child.isSidechain) continue;
      if (isToolResultRecord(child)) {
        keep.add(child.uuid);
        continue;
      }
      const n = subtreeTurns(child);
      if (n > 0) abandoned.push({ atUuid: uuid, records: n, timestamp: child.timestamp });
    }
  }

  const active = records.filter((r) => r.uuid && keep.has(r.uuid));
  return { active, abandoned, reconnectedCompaction };
}

// ---------- mapping to Events ----------

const EXCERPT_LIMIT = 4096;
const ERROR_LIMIT = 8192;

export function excerpt(text: string, limit = EXCERPT_LIMIT): OutputExcerpt {
  const sha256 = createHash("sha256").update(text).digest("hex");
  if (text.length <= limit) return { excerpt: text, truncated: false, originalLength: text.length, sha256 };
  const head = text.slice(0, 2048);
  const tail = text.slice(-1024);
  const omitted = text.length - head.length - tail.length;
  return { excerpt: `${head}\n…[${omitted} chars omitted]…\n${tail}`, truncated: true, originalLength: text.length, sha256 };
}

const stripReminders = (s: string) => s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();

function resultText(content: string | Block[] | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b) => (b.type === "text" ? b.text : b.type === "image" ? "[image]" : "")).filter(Boolean).join("\n");
}

function excerptInput(input: unknown): unknown {
  const json = JSON.stringify(input ?? null);
  return json.length <= EXCERPT_LIMIT ? input : { excerpted: excerpt(json) };
}

const FILE_TOOLS: Record<string, "read" | "write" | "edit"> = {
  Read: "read",
  Write: "write",
  Edit: "edit",
  MultiEdit: "edit",
  NotebookEdit: "edit",
};

/** Derived events (file events, errors) get ids in a separate range from the block they came from. */
const DERIVED = 1000;

export function toEvents(nativeSessionId: string, branch: Branch): CapturedEvent[] {
  const out: Omit<CapturedEvent, "seq">[] = [];
  const toolNames = new Map<string, string>();
  const abandonedAt = new Map<string, Abandoned[]>();
  for (const a of branch.abandoned) abandonedAt.set(a.atUuid, [...(abandonedAt.get(a.atUuid) ?? []), a]);

  for (const r of branch.active) {
    const uuid = r.uuid ?? "";
    const ts = new Date(r.timestamp ?? 0);
    const base = (blockIndex: number) => ({ _id: eventId(nativeSessionId, uuid, blockIndex), ts, sidechain: Boolean(r.isSidechain) });

    if (r.type === "system" && r.level === "error" && r.content) {
      out.push({ ...base(0), type: "error", text: r.content.slice(0, ERROR_LIMIT) });
    }

    const skipUser = r.type === "user" && (r.isMeta || (r.isCompactSummary && branch.reconnectedCompaction));
    if (isTurn(r) && !skipUser) {
      blocksOf(r).forEach((b, i) => {
        if (b.type === "text") {
          const text = r.type === "user" ? stripReminders(b.text) : b.text.trim();
          if (!text) return;
          const labelled = r.isCompactSummary ? `[Earlier conversation, summarized when the context was compacted]\n${text}` : text;
          out.push({ ...base(i), type: r.type === "user" ? "user_message" : "assistant_message", text: labelled });
        } else if (b.type === "image" && r.type === "user") {
          out.push({ ...base(i), type: "user_message", text: "[image]" });
        } else if (b.type === "tool_use") {
          toolNames.set(b.id, b.name);
          out.push({ ...base(i), type: "tool_call", tool: { name: b.name, useId: b.id, input: excerptInput(b.input) } });
          const op = FILE_TOOLS[b.name];
          const path = (b.input as { file_path?: unknown; notebook_path?: unknown } | undefined) ?? {};
          const file = typeof path.file_path === "string" ? path.file_path : typeof path.notebook_path === "string" ? path.notebook_path : null;
          if (op && file) out.push({ ...base(DERIVED + i), type: op === "read" ? "file_read" : "file_change", file: { path: file, op } });
        } else if (b.type === "tool_result") {
          const text = resultText(b.content);
          const name = toolNames.get(b.tool_use_id) ?? "unknown";
          out.push({
            ...base(i),
            type: "tool_result",
            tool: { name, useId: b.tool_use_id, isError: Boolean(b.is_error) },
            output: excerpt(text, b.is_error ? ERROR_LIMIT : EXCERPT_LIMIT),
          });
          if (b.is_error) out.push({ ...base(DERIVED + i), type: "error", tool: { name, useId: b.tool_use_id, isError: true }, text: text.slice(0, ERROR_LIMIT) });
        }
        // thinking and redacted_thinking are dropped: hidden reasoning is never portable.
      });
    }

    for (const a of abandonedAt.get(uuid) ?? []) {
      out.push({
        _id: eventId(nativeSessionId, `${uuid}:abandoned:${a.timestamp ?? ""}`, 0),
        ts: new Date(a.timestamp ?? r.timestamp ?? 0),
        sidechain: false,
        type: "branch_abandoned",
        text: `A branch of ${a.records} message${a.records === 1 ? "" : "s"} was abandoned here (the conversation was rewound).`,
      });
    }
  }
  return out.map((e, seq) => ({ ...e, seq }));
}

export function sessionTitle(records: RawRecord[]): string {
  const custom = records.filter((r) => r.type === "custom-title" && r.customTitle).at(-1)?.customTitle;
  if (custom) return custom.slice(0, 80);
  for (const r of records) {
    if (r.type !== "user" || r.isMeta || r.isCompactSummary) continue;
    const text = blocksOf(r).map((b) => (b.type === "text" ? stripReminders(b.text) : "")).join(" ").trim();
    if (text) return text.replace(/\s+/g, " ").slice(0, 80);
  }
  return "Untitled session";
}

/** True for sessions that Stash itself started to run extraction (never pushed). */
export function isStashOwnSession(records: RawRecord[]): boolean {
  const first = records.find((r) => r.type === "user" && !r.isMeta);
  const text = first ? blocksOf(first).map((b) => (b.type === "text" ? b.text : "")).join("") : "";
  return text.trimStart().startsWith(EXTRACT_MARKER);
}

export function captureFromText(nativeSessionId: string, text: string): CapturedSession {
  const records = parseJsonl(text);
  const branch = selectActiveBranch(records);
  const last = branch.active.at(-1);
  return {
    nativeSessionId,
    title: sessionTitle(records),
    cwd: last?.cwd ?? null,
    gitBranch: last?.gitBranch ?? null,
    events: toEvents(nativeSessionId, branch),
  };
}

// ---------- files ----------

/** Claude Code's folder name for a working directory: every non-alphanumeric character becomes "-". */
export const projectSlug = (cwd: string) => cwd.replace(/[^a-zA-Z0-9]/g, "-");

export const claudeProjectsDir = () => process.env.CLAUDE_CONFIG_DIR
  ? join(process.env.CLAUDE_CONFIG_DIR, "projects")
  : join(homedir(), ".claude", "projects");

export async function listSessionsIn(dir: string): Promise<SessionCandidate[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".jsonl"));
  } catch {
    return [];
  }
  const out: SessionCandidate[] = [];
  for (const name of names) {
    const path = join(dir, name);
    const [info, text] = await Promise.all([stat(path), readFile(path, "utf8")]);
    const records = parseJsonl(text);
    if (isStashOwnSession(records) || !records.some(isTurn)) continue;
    out.push({ nativeSessionId: name.slice(0, -".jsonl".length), path, title: sessionTitle(records), modifiedAt: info.mtime });
  }
  return out.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

export const claudeCode: AgentAdapter = {
  agent: "claude-code",
  listSessions: (cwd) => listSessionsIn(join(claudeProjectsDir(), projectSlug(cwd))),
  async capture(path) {
    const id = path.split("/").at(-1)?.replace(/\.jsonl$/, "") ?? "unknown";
    return captureFromText(id, await readFile(path, "utf8"));
  },
};

export type { Event };
