import { describe, expect, it } from "vitest";
import { buildBriefing, mergePrompt, validateMerge, type MergeOutput, type PreparedMerge } from "./index.js";

const digest = { objective: "o", progress: "p", completed: [], openTasks: [], files: [] };
const prepared: PreparedMerge = {
  a: { sessionId: "ses_a", version: 2, title: "Race", digest, memories: [
    { _id: "mem_a1", type: "discovery", status: "evidenced", text: "Refresh runs twice.", eventIds: ["ev1"] },
    { _id: "mem_a2", type: "discovery", status: "hypothesis", text: "The database is fine.", eventIds: ["ev2"] },
  ] },
  b: { sessionId: "ses_b", version: 1, title: "Cache", digest, memories: [
    { _id: "mem_b1", type: "discovery", status: "evidenced", text: "Refresh is called twice per request burst.", eventIds: ["ev3"] },
    { _id: "mem_b2", type: "discovery", status: "evidenced", text: "Cache TTL is in the wrong unit.", eventIds: ["ev4"] },
    { _id: "mem_b3", type: "failed_approach", status: "evidenced", text: "Raising DB timeout did nothing.", eventIds: ["ev5"] },
  ] },
  pairs: [{ a: "mem_a1", b: "mem_b1", score: 0.86 }],
  evidence: [],
};

describe("mergePrompt", () => {
  it("lists both sources under A/B aliases with candidate pairs", () => {
    const p = mergePrompt(prepared);
    expect(p).toContain("A1 [discovery, evidenced] Refresh runs twice.");
    expect(p).toContain("B3 [failed_approach, evidenced] Raising DB timeout did nothing.");
    expect(p).toContain("A1 ~ B1 (similarity 0.86)");
  });
});

describe("validateMerge", () => {
  const out: MergeOutput = {
    digest: { ...digest, completed: [{ text: "Found the race", memoryIds: ["A1", "B1"] }] },
    findings: [
      { kind: "duplicate", summary: "Both found the double refresh.", memoryIds: ["A1", "B1"] },
      { kind: "complementary", summary: "The cache explains /me failures.", memoryIds: ["B2", "Z9"] },
      { kind: "conflicting", summary: "Is the database involved?", memoryIds: ["A2"] },
      { kind: "duplicate", summary: "Nothing real.", memoryIds: ["Z1"] },
    ],
  };
  const v = validateMerge(out, prepared);

  it("resolves aliases, drops unknown ids and empty findings, and derives Events", () => {
    expect(v.findings.find((f) => f.kind === "duplicate")).toEqual({ kind: "duplicate", summary: "Both found the double refresh.", memoryIds: ["mem_a1", "mem_b1"], eventIds: ["ev1", "ev3"] });
    expect(v.findings.some((f) => f.summary === "Nothing real.")).toBe(false);
    expect(v.digest.completed[0]?.eventIds).toEqual(["ev1", "ev3"]);
  });

  it("covers every Memory, adding only-in-one Findings for any left out", () => {
    const covered = new Set(v.findings.flatMap((f) => f.memoryIds));
    expect([...covered].sort()).toEqual(["mem_a1", "mem_a2", "mem_b1", "mem_b2", "mem_b3"]);
    expect(v.added).toBe(1);
    expect(v.findings.at(-1)).toMatchObject({ kind: "only_in_one", memoryIds: ["mem_b3"] });
  });

  it("puts conflicts first", () => {
    expect(v.findings[0]?.kind).toBe("conflicting");
  });
});

describe("Merge Briefing", () => {
  it("shows Findings by kind, conflicts first, and names both sources", () => {
    const v = validateMerge({ digest, findings: [
      { kind: "duplicate", summary: "Both found the double refresh.", memoryIds: ["A1", "B1"] },
      { kind: "conflicting", summary: "Is the database involved?", memoryIds: ["A2", "B3"] },
    ] }, prepared);
    const { markdown } = buildBriefing({
      sourceId: "m_abc12345", version: 1, pullId: "p_x", projectName: "demo", agent: "merge", machine: "", pushedAt: new Date(0),
      extractedBy: null, digest, guardrails: [], memories: [], related: [], keyEvents: [],
      merge: { sources: [{ sessionId: "ses_a", version: 2 }, { sessionId: "ses_b", version: 1 }], findings: v.findings },
    });
    expect(markdown.startsWith("stash:briefing m_abc12345@v1 pull=p_x")).toBe(true);
    expect(markdown).toContain("From a Merge of ses_a v2 and ses_b v1.");
    expect(markdown.indexOf("## Conflicting findings")).toBeLessThan(markdown.indexOf("## Duplicate findings"));
  });
});
