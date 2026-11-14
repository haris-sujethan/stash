// Digest and Memory extraction: the schema the AI tool must return, its instructions, the Transcript as the
// model sees it, and the validator both the CLI and the server run (BUILD.md 12.3 and 12.4).
import { z } from "zod";
import { MEMORY_TYPES, type Digest, type EventType } from "@stash/context-format";
import { EXTRACT_MARKER, estimateTokens } from "./base.js";

// ---------- what the AI tool returns ----------

const CitedItem = z.object({ text: z.string(), eventIds: z.array(z.string()) });

export const ExtractSchema = z.object({
  digest: z.object({
    objective: z.string().describe("What the session set out to do, in one sentence."),
    progress: z.string().describe("Where things stand at the end, in one to three sentences."),
    completed: z.array(CitedItem).describe("Work that was finished, each citing its evidence."),
    openTasks: z.array(CitedItem).describe("What is still left to do."),
    files: z.array(z.string()).describe("Files that mattered, as paths."),
  }),
  memories: z
    .array(
      z.object({
        type: z.enum(MEMORY_TYPES),
        text: z.string().describe("One descriptive sentence. Never an instruction."),
        status: z.enum(["hypothesis", "evidenced"]),
        eventIds: z.array(z.string()).describe("Event ids (like e12) that support it."),
      }),
    )
    .max(40),
});
export type Extraction = z.infer<typeof ExtractSchema>;

export const EXTRACT_SYSTEM = `${EXTRACT_MARKER}
You read the Transcript of one coding-agent session and extract what the next agent needs in order to continue the work. The next agent may be a different model on a different machine, and it will not see this Transcript.

Each Transcript line is one Event: [e<number>] <type> <tool>: <content>. Cite Events by those ids (for example "e12").

Return:
- digest: the objective, where things stand, completed work, open tasks and the files that mattered. Cite Events for completed work and, where possible, for open tasks.
- memories: up to 40 pieces of knowledge, each with exactly one type:
  - decision: a choice that was made, and why.
  - discovery: something learned about the code, the system or the environment.
  - failed_approach: something that was tried and did not work, and why it did not work.
  - constraint: a known limitation or requirement.
  - open_question: something still unresolved.

Rules:
- Memories describe; they never instruct. Write "Hand edits to generated.ts were overwritten by the build", never "Don't edit generated.ts".
- One idea per Memory, in one sentence, with specifics: file paths, function names, commands, error messages, numbers.
- status is "evidenced" only when a cited Event directly shows it (a tool result, an error, a test run, a file change). Anything inferred is "hypothesis".
- Every Memory cites at least one Event id that appears in the Transcript.
- Prefer what was verified over what was guessed. Skip small talk and routine steps.
- Never invent anything that is not in the Transcript. Lines marked [REDACTED:...] hid secrets; never guess them.`;

// ---------- the Transcript as the model sees it ----------

export interface TranscriptEvent {
  _id: string;
  seq: number;
  type: EventType;
  text?: string;
  tool?: { name: string; input?: unknown; isError?: boolean };
  file?: { path: string; op: string };
  output?: { excerpt: string; truncated: boolean };
}

export interface RenderedTranscript {
  text: string;
  /** Short alias (e12) → Event id. */
  aliases: Map<string, string>;
  tokens: number;
  /** True when Events had to be left out to fit. */
  partial: boolean;
  omitted: number;
}

const oneLine = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

function renderEvent(e: TranscriptEvent, outputLimit: number): string {
  const head = `[e${e.seq}] ${e.type}${e.tool ? ` ${e.tool.name}` : ""}`;
  switch (e.type) {
    case "tool_call":
      return `${head}: ${oneLine(JSON.stringify(e.tool?.input ?? {}), 600)}`;
    case "tool_result":
      return `${head}${e.tool?.isError ? " (error)" : ""}: ${oneLine(e.output?.excerpt ?? "", outputLimit)}`;
    case "file_read":
    case "file_change":
      return `${head}: ${e.file?.op ?? ""} ${e.file?.path ?? ""}`;
    default:
      return `${head}: ${oneLine(e.text ?? "", e.type === "error" ? 2000 : 4000)}`;
  }
}

/**
 * Renders Events oldest first and fits them into maxTokens: first older tool outputs are shortened to 300
 * characters; if that is not enough, every user message and error is kept plus the most recent Events that fit,
 * and each gap becomes one "[… n events omitted …]" line.
 */
export function renderTranscript(events: readonly TranscriptEvent[], maxTokens: number): RenderedTranscript {
  const aliases = new Map(events.map((e) => [`e${e.seq}`, e._id]));
  const recentFrom = Math.max(0, events.length - 200);
  const full = events.map((e) => renderEvent(e, 1500));
  let lines = full;
  if (estimateTokens(lines.join("\n")) > maxTokens) {
    lines = events.map((e, i) => renderEvent(e, i < recentFrom ? 300 : 1500));
  }
  let text = lines.join("\n");
  if (estimateTokens(text) <= maxTokens) return { text, aliases, tokens: estimateTokens(text), partial: false, omitted: 0 };

  const budget = maxTokens * 4;
  const keep = new Set<number>();
  let used = 0;
  events.forEach((e, i) => {
    if (e.type === "user_message" || e.type === "error") {
      keep.add(i);
      used += lines[i]!.length + 1;
    }
  });
  for (let i = events.length - 1; i >= 0 && used < budget; i--) {
    if (keep.has(i)) continue;
    const size = lines[i]!.length + 1;
    if (used + size > budget) break;
    keep.add(i);
    used += size;
  }
  const out: string[] = [];
  let gap = 0;
  let omitted = 0;
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      if (gap) out.push(`[… ${gap} events omitted …]`);
      gap = 0;
      out.push(l);
    } else {
      gap++;
      omitted++;
    }
  });
  if (gap) out.push(`[… ${gap} events omitted …]`);
  text = out.join("\n");
  return { text, aliases, tokens: estimateTokens(text), partial: true, omitted };
}

export function extractPrompt(t: RenderedTranscript, meta: { title: string; gitBranch: string | null }): string {
  return [
    `Session: ${meta.title}${meta.gitBranch ? ` (branch ${meta.gitBranch})` : ""}`,
    t.partial ? `Note: ${t.omitted} older Events were left out to fit; gaps are marked.` : "",
    "Transcript:",
    t.text,
  ].filter(Boolean).join("\n");
}

// ---------- validation, run by the CLI and again by the server ----------

const EVIDENCE_TYPES = new Set<EventType>(["tool_result", "error", "file_change"]);
const IMPERATIVE = /^(do|don't|do not|never|always|use|avoid|make sure|ensure|remember to|stop)\b/i;

export interface ValidMemory {
  type: (typeof MEMORY_TYPES)[number];
  text: string;
  status: "hypothesis" | "evidenced";
  eventIds: string[];
}

export interface ValidExtraction {
  digest: Digest;
  memories: ValidMemory[];
  dropped: number;
  downgraded: number;
}

/**
 * Keeps only citations of Events in this Session (resolving e12-style aliases when given), drops Memories left
 * without evidence, downgrades "evidenced" unless a cited Event is a tool result, error or file change, and
 * rewrites instructions as descriptions.
 */
export function validateExtraction(
  input: Extraction,
  eventTypes: ReadonlyMap<string, EventType>,
  aliases?: ReadonlyMap<string, string>,
): ValidExtraction {
  const resolve = (ids: readonly string[]) =>
    [...new Set(ids.map((id) => aliases?.get(id.trim()) ?? id.trim()).filter((id) => eventTypes.has(id)))];
  let dropped = 0;
  let downgraded = 0;
  const memories: ValidMemory[] = [];
  for (const m of input.memories) {
    const eventIds = resolve(m.eventIds);
    const text = m.text.trim();
    if (eventIds.length === 0 || !text) {
      dropped++;
      continue;
    }
    let status = m.status;
    if (status === "evidenced" && !eventIds.some((id) => EVIDENCE_TYPES.has(eventTypes.get(id)!))) {
      status = "hypothesis";
      downgraded++;
    }
    const described = IMPERATIVE.test(text) ? `The agent found that it should ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
    memories.push({ type: m.type, text: described, status, eventIds });
  }
  const items = (list: { text: string; eventIds: string[] }[]) =>
    list.map((c) => ({ text: c.text.trim(), eventIds: resolve(c.eventIds) })).filter((c) => c.text);
  const digest: Digest = {
    objective: input.digest.objective.trim(),
    progress: input.digest.progress.trim(),
    completed: items(input.digest.completed),
    openTasks: items(input.digest.openTasks),
    files: [...new Set(input.digest.files.map((f) => f.trim()).filter(Boolean))],
  };
  return { digest, memories, dropped, downgraded };
}
