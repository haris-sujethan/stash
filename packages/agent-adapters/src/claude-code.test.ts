import { describe, expect, it } from "vitest";
import { captureFromText, excerpt, isStashOwnSession, parseJsonl, projectSlug, selectActiveBranch } from "./claude-code.js";

// A small session shaped like real Claude Code files: one record per content block, parent links through
// attachment records, parallel tool calls, a rewind, a hidden thinking block and an error.
let clock = 0;
const ts = () => new Date(Date.UTC(2026, 10, 14, 12, 0, clock++)).toISOString();
const SID = "6f2e0000-0000-0000-0000-000000000001";
const common = { sessionId: SID, cwd: "/work/stash-demo", gitBranch: "main", isSidechain: false };
const user = (uuid: string, parentUuid: string | null, content: unknown, extra: object = {}) =>
  ({ type: "user", uuid, parentUuid, timestamp: ts(), message: { role: "user", content }, ...common, ...extra });
const assistant = (uuid: string, parentUuid: string, block: object) =>
  ({ type: "assistant", uuid, parentUuid, timestamp: ts(), message: { role: "assistant", content: [block] }, ...common });

const records = [
  { type: "queue-operation", operation: "enqueue" },
  user("u1", null, "Users get logged out at random. Find out why."),
  { type: "attachment", uuid: "x1", parentUuid: "u1", timestamp: ts() },
  assistant("a1", "x1", { type: "thinking", thinking: "secret reasoning", signature: "sig" }),
  assistant("a2", "a1", { type: "text", text: "Let me look at the auth code." }),
  assistant("a3", "a2", { type: "tool_use", id: "t1", name: "Read", input: { file_path: "/work/stash-demo/src/auth/tokens.ts" } }),
  user("r1", "a3", [{ type: "tool_result", tool_use_id: "t1", content: "export async function getValidToken() {}" }]),
  // Two tool calls in parallel: both results hang off different records.
  assistant("a4", "r1", { type: "tool_use", id: "t2", name: "Bash", input: { command: "cat .env" } }),
  assistant("a5", "a4", { type: "tool_use", id: "t3", name: "Edit", input: { file_path: "/work/stash-demo/src/client/generated.ts", old_string: "a", new_string: "b" } }),
  user("r2", "a4", [{ type: "tool_result", tool_use_id: "t2", content: "ANTHROPIC_API_KEY=sk-ant-demo-AbCdEfGhIjKlMnOpQrStUvWx\nPORT=4000" }]),
  user("r3", "a5", [{ type: "tool_result", tool_use_id: "t3", content: "File has been modified", is_error: false }]),
  assistant("a6", "r3", { type: "tool_use", id: "t4", name: "Bash", input: { command: "npm test" } }),
  user("r4", "a6", [{ type: "tool_result", tool_use_id: "t4", content: "3 failed: refresh() called twice", is_error: true }]),
  user("m1", "r4", "<command-name>/model</command-name>", { isMeta: true }),
  // A branch that was later abandoned by rewinding.
  user("u2", "m1", "Try raising the database timeout to 30 seconds."),
  assistant("a7", "u2", { type: "text", text: "Raised DB_TIMEOUT_MS to 30000." }),
  { type: "custom-title", customTitle: "Investigate intermittent logouts", sessionId: SID },
  // The rewind: a new prompt from the same point.
  user("u3", "m1", "Check whether two requests refresh at the same time. <system-reminder>noise</system-reminder>"),
  assistant("a8", "u3", { type: "text", text: "Both requests reuse the same refresh token." }),
].map((r) => JSON.stringify(r));
const text = records.join("\n") + "\n{ partial line";

describe("parseJsonl", () => {
  it("skips malformed lines", () => {
    expect(parseJsonl(text)).toHaveLength(records.length);
  });
});

describe("selectActiveBranch", () => {
  const branch = selectActiveBranch(parseJsonl(text));
  const ids = branch.active.map((r) => r.uuid);

  it("follows the branch the session ended on, through attachments", () => {
    expect(ids).toContain("x1");
    expect(ids.at(-1)).toBe("a8");
    expect(ids).not.toContain("u2");
    expect(ids).not.toContain("a7");
  });

  it("keeps results of parallel tool calls", () => {
    expect(ids).toContain("r2");
    expect(ids).toContain("r3");
  });

  it("records the rewind as one abandoned branch", () => {
    expect(branch.abandoned).toEqual([{ atUuid: "m1", records: 2, timestamp: expect.any(String) }]);
  });
});

describe("captureFromText", () => {
  const s = captureFromText(SID, text);
  const types = s.events.map((e) => e.type);

  it("uses the custom title and the last cwd and branch", () => {
    expect(s.title).toBe("Investigate intermittent logouts");
    expect(s.cwd).toBe("/work/stash-demo");
    expect(s.gitBranch).toBe("main");
  });

  it("drops thinking, meta records and system reminders", () => {
    const all = JSON.stringify(s.events);
    expect(all).not.toContain("secret reasoning");
    expect(all).not.toContain("/model");
    expect(all).not.toContain("noise");
  });

  it("maps blocks to Events in order", () => {
    expect(types).toEqual([
      "user_message",
      "assistant_message",
      "tool_call", "file_read",
      "tool_result",
      "tool_call",
      "tool_call", "file_change",
      "tool_result",
      "tool_result",
      "tool_call",
      "tool_result", "error",
      "branch_abandoned",
      "user_message",
      "assistant_message",
    ]);
    expect(s.events.map((e) => e.seq)).toEqual(types.map((_, i) => i));
  });

  it("names tool results after their call and flags errors", () => {
    const failing = s.events.find((e) => e.type === "tool_result" && e.tool?.isError);
    expect(failing?.tool?.name).toBe("Bash");
    expect(s.events.find((e) => e.type === "file_change")?.file).toEqual({ path: "/work/stash-demo/src/client/generated.ts", op: "edit" });
  });

  it("gives stable, unique Event ids", () => {
    const again = captureFromText(SID, text);
    expect(again.events.map((e) => e._id)).toEqual(s.events.map((e) => e._id));
    expect(new Set(s.events.map((e) => e._id)).size).toBe(s.events.length);
  });
});

describe("compaction", () => {
  it("reconnects history whose compaction parent is missing, and drops the summary", () => {
    const lines = [
      user("p1", null, "Original request."),
      assistant("p2", "p1", { type: "text", text: "Earlier work." }),
      { type: "system", subtype: "compact_boundary", uuid: "cb", parentUuid: null, logicalParentUuid: "missing", timestamp: ts(), ...common },
      user("cs", "cb", "Summary of the earlier conversation.", { isCompactSummary: true }),
      assistant("p3", "cs", { type: "text", text: "Continuing." }),
    ].map((r) => JSON.stringify(r)).join("\n");
    const s = captureFromText(SID, lines);
    expect(s.events.map((e) => e.text)).toEqual(["Original request.", "Earlier work.", "Continuing."]);
  });
});

describe("helpers", () => {
  it("keeps the head and tail of large outputs", () => {
    const big = "a".repeat(3000) + "MIDDLE" + "z".repeat(3000);
    const x = excerpt(big);
    expect(x.truncated).toBe(true);
    expect(x.originalLength).toBe(6006);
    expect(x.excerpt).not.toContain("MIDDLE");
    expect(x.excerpt.endsWith("z".repeat(1024))).toBe(true);
  });

  it("matches Claude Code's folder names", () => {
    expect(projectSlug("/Users/me/Desktop/stash")).toBe("-Users-me-Desktop-stash");
    expect(projectSlug("/Users/me/my.app")).toBe("-Users-me-my-app");
  });

  it("recognizes Stash's own extraction sessions", () => {
    expect(isStashOwnSession(parseJsonl(JSON.stringify(user("s", null, "stash:extract\nYou are given…"))))).toBe(true);
    expect(isStashOwnSession(parseJsonl(records[1] ?? ""))).toBe(false);
  });
});

import { findBriefingMarkers } from "@stash/core";

describe("lineage markers survive capture", () => {
  it("keeps the marker of a long Briefing printed by stash pull", () => {
    const briefing = "stash:briefing ses_8kq2v@v2 pull=p_91x7k2ma\n\n# Briefing: …\n" + "- a memory line\n".repeat(600);
    const lines = [
      user("u1", null, "Pull the context first."),
      assistant("a1", "u1", { type: "tool_use", id: "t1", name: "Bash", input: { command: "stash pull ses_8kq2v" } }),
      user("r1", "a1", [{ type: "tool_result", tool_use_id: "t1", content: briefing }]),
    ].map((r) => JSON.stringify(r)).join("\n");
    const result = captureFromText(SID, lines).events.find((e) => e.type === "tool_result");
    expect(result?.output?.truncated).toBe(true);
    expect(findBriefingMarkers(result?.output?.excerpt ?? "")).toEqual([
      { sourceId: "ses_8kq2v", sourceType: "session", sourceVersion: 2, pullId: "p_91x7k2ma" },
    ]);
  });
});
