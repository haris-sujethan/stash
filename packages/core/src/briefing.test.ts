import { describe, expect, it } from "vitest";
import { buildBriefing, orderRelated, type BriefingInput, type BriefingMemory, type RelatedMemory } from "./index.js";

const mem = (i: number, type: BriefingMemory["type"], status: BriefingMemory["status"] = "evidenced", pad = 0): BriefingMemory => ({
  _id: `mem_${i}`,
  type,
  status,
  text: `${type} number ${i}${" detail".repeat(pad)}`,
  eventIds: [`abcdef${String(i).padStart(10, "0")}`],
});

const related = (i: number, type: RelatedMemory["type"], score: number, text = `related ${i}`): RelatedMemory => ({
  ...mem(i, type),
  text,
  sessionId: `ses_other${i}`,
  sessionTitle: "Cache investigation",
  score,
});

function input(over: Partial<BriefingInput> = {}): BriefingInput {
  return {
    sourceId: "ses_8kq2v",
    version: 2,
    pullId: "p_91x7k2ma",
    projectName: "stash-demo",
    agent: "claude-code",
    machine: "laptop-1.local",
    pushedAt: new Date("2026-11-14T14:12:00Z"),
    extractedBy: { tool: "claude", model: "claude-sonnet-5-5" },
    digest: { objective: "Investigate intermittent login failures", progress: "Found a refresh race.", completed: [], openTasks: [{ text: "Fix the race", eventIds: [] }], files: ["src/auth/tokens.ts"] },
    guardrails: [{ rule: "Edit schema/api.yaml and run npm run generate; never edit src/client/generated.ts by hand." }],
    memories: [mem(1, "decision"), mem(2, "discovery"), mem(3, "discovery", "hypothesis"), mem(4, "failed_approach"), mem(5, "constraint"), mem(6, "open_question")],
    related: [related(7, "discovery", 0.8), related(8, "failed_approach", 0.7)],
    keyEvents: [{ _id: "e14aaaaaaaaaaaaaaaaaaaaa", type: "tool_result", tool: "Bash", excerpt: "3 failed: refresh() called twice" }],
    ...over,
  };
}

describe("buildBriefing", () => {
  it("renders every section in the fixed order, marker first", () => {
    const { markdown } = buildBriefing(input());
    expect(markdown.split("\n")[0]).toBe("stash:briefing ses_8kq2v@v2 pull=p_91x7k2ma");
    const order = [
      "## Rules every agent follows (approved)",
      "## Where things stand",
      "## Decisions",
      "## Discoveries",
      "## Failed approaches (do not retry)",
      "## Constraints",
      "## Open questions and next steps",
      "## Related from other sessions",
      "## Key evidence",
    ].map((h) => markdown.indexOf(h));
    expect(order.every((pos) => pos > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markdown).toContain("[hypothesis]");
    expect(markdown).toContain("- Next: Fix the race");
    expect(markdown).not.toContain("Ask for more");
  });

  it("is deterministic", () => {
    expect(buildBriefing(input()).markdown).toBe(buildBriefing(input()).markdown);
  });

  it("drops related Memories before the Session's own, and never drops Guardrails", () => {
    const big = input({
      memories: Array.from({ length: 30 }, (_, i) => mem(i, i % 2 ? "discovery" : "failed_approach", "evidenced", 20)),
      related: Array.from({ length: 8 }, (_, i) => related(100 + i, "discovery", 0.9 - i / 100, `related ${i}${" detail".repeat(20)}`)),
    });
    const out = buildBriefing(big, 1500);
    expect(out.tokens).toBeLessThanOrEqual(1500);
    expect(out.markdown).toContain("never edit src/client/generated.ts");
    expect(out.markdown).toContain("Investigate intermittent login failures");
    expect(out.markdown).not.toContain("## Related from other sessions");
    expect(out.relatedMemoryIds).toEqual([]);
    expect(out.markdown).toContain("Ask for more: stash pull ses_8kq2v");
  });

  it("drops open questions and hypotheses before evidenced failures", () => {
    const x = input({ memories: [mem(1, "failed_approach", "evidenced", 60), mem(2, "open_question", "hypothesis", 60), mem(3, "discovery", "hypothesis", 60)], related: [], keyEvents: [] });
    const full = buildBriefing(x, 100_000).tokens;
    const slightly = buildBriefing(x, full - 1).markdown;
    expect(slightly).not.toContain("open_question number 2");
    expect(slightly).toContain("discovery number 3");
    const more = buildBriefing(x, full - 150).markdown;
    expect(more).not.toContain("discovery number 3");
    expect(more).toContain("failed_approach number 1");
  });

  it("keeps the Guardrails even when the budget is impossibly small", () => {
    const out = buildBriefing(input(), 10);
    expect(out.markdown).toContain("## Rules every agent follows (approved)");
    expect(out.markdown.startsWith("stash:briefing")).toBe(true);
  });
});

describe("orderRelated", () => {
  it("puts failed approaches first, removes duplicate texts, keeps 8", () => {
    const list = [related(1, "discovery", 0.9), related(2, "failed_approach", 0.6), related(3, "discovery", 0.8, "related 1"), ...Array.from({ length: 10 }, (_, i) => related(10 + i, "discovery", 0.5))];
    const out = orderRelated(list);
    expect(out[0]?.type).toBe("failed_approach");
    expect(out.filter((m) => m.text === "related 1")).toHaveLength(1);
    expect(out).toHaveLength(8);
  });
});
