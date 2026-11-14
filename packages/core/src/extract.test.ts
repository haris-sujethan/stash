import { describe, expect, it } from "vitest";
import type { EventType } from "@stash/context-format";
import { renderTranscript, validateExtraction, type Extraction, type TranscriptEvent } from "./index.js";

const ev = (seq: number, type: EventType, extra: Partial<TranscriptEvent> = {}): TranscriptEvent => ({ _id: `id${seq}`, seq, type, ...extra });

describe("renderTranscript", () => {
  const events = [
    ev(0, "user_message", { text: "Find the logout bug" }),
    ev(1, "tool_call", { tool: { name: "Bash", input: { command: "npm test" } } }),
    ev(2, "tool_result", { tool: { name: "Bash", isError: true }, output: { excerpt: "3 failed", truncated: false } }),
    ev(3, "file_change", { file: { path: "src/a.ts", op: "edit" } }),
  ];

  it("labels each Event with a short alias", () => {
    const t = renderTranscript(events, 10_000);
    expect(t.text.split("\n")).toEqual([
      "[e0] user_message: Find the logout bug",
      '[e1] tool_call Bash: {"command":"npm test"}',
      "[e2] tool_result Bash (error): 3 failed",
      "[e3] file_change: edit src/a.ts",
    ]);
    expect(t.aliases.get("e2")).toBe("id2");
    expect(t.partial).toBe(false);
  });

  it("keeps user messages and errors and marks gaps when it must cut", () => {
    const many = [ev(0, "user_message", { text: "start" }), ...Array.from({ length: 300 }, (_, i) => ev(i + 1, "assistant_message", { text: "x".repeat(400) })), ev(301, "error", { text: "boom" })];
    const t = renderTranscript(many, 2000);
    expect(t.partial).toBe(true);
    expect(t.text).toContain("[e0] user_message: start");
    expect(t.text).toContain("[e301] error: boom");
    expect(t.text).toMatch(/\[… \d+ events omitted …\]/);
    expect(t.tokens).toBeLessThanOrEqual(2100);
  });
});

describe("validateExtraction", () => {
  const types = new Map<string, EventType>([["id0", "user_message"], ["id2", "tool_result"], ["id5", "assistant_message"]]);
  const aliases = new Map([["e0", "id0"], ["e2", "id2"], ["e5", "id5"]]);
  const base: Extraction = {
    digest: { objective: " Fix logouts ", progress: "Found the race.", completed: [{ text: "Ran tests", eventIds: ["e2", "e99"] }], openTasks: [], files: ["a.ts", "a.ts"] },
    memories: [],
  };

  it("resolves aliases, drops unknown citations and Memories left without evidence", () => {
    const v = validateExtraction({ ...base, memories: [
      { type: "discovery", text: "Refresh runs twice.", status: "evidenced", eventIds: ["e2", "e99"] },
      { type: "discovery", text: "Made up.", status: "evidenced", eventIds: ["e99"] },
    ] }, types, aliases);
    expect(v.memories).toEqual([{ type: "discovery", text: "Refresh runs twice.", status: "evidenced", eventIds: ["id2"] }]);
    expect(v.dropped).toBe(1);
    expect(v.digest.completed).toEqual([{ text: "Ran tests", eventIds: ["id2"] }]);
    expect(v.digest.objective).toBe("Fix logouts");
    expect(v.digest.files).toEqual(["a.ts"]);
  });

  it("downgrades evidenced claims that cite no tool result, error or file change", () => {
    const v = validateExtraction({ ...base, memories: [{ type: "decision", text: "Chose the race first.", status: "evidenced", eventIds: ["e5"] }] }, types, aliases);
    expect(v.memories[0]?.status).toBe("hypothesis");
    expect(v.downgraded).toBe(1);
  });

  it("rewrites instructions as descriptions", () => {
    const v = validateExtraction({ ...base, memories: [{ type: "constraint", text: "Never edit generated.ts by hand.", status: "evidenced", eventIds: ["e2"] }] }, types, aliases);
    expect(v.memories[0]?.text).toBe("The agent found that it should never edit generated.ts by hand.");
  });

  it("accepts real ids too, as the server sends them", () => {
    const v = validateExtraction({ ...base, memories: [{ type: "discovery", text: "x", status: "hypothesis", eventIds: ["id0"] }] }, types);
    expect(v.memories[0]?.eventIds).toEqual(["id0"]);
  });
});
