import { describe, expect, it } from "vitest";
import { decideGuardrail, guardrailPrompt, type ExistingGuardrail, type GuardrailCandidates, type GuardrailCheck } from "./index.js";

const c: GuardrailCandidates = {
  failure: { memoryId: "mem_n", sessionId: "ses_new", sessionTitle: "Add a timeout", text: "Hand edits to generated.ts were overwritten by npm run build.", evidence: [{ type: "tool_result", tool: "Bash", excerpt: "generated src/client/generated.ts" }] },
  matches: [
    { memoryId: "mem_f1", sessionId: "ses_old", sessionTitle: "Add retries", text: "Editing generated.ts by hand failed check:generated.", score: 0.88, evidence: [] },
    { memoryId: "mem_f2", sessionId: "ses_new", sessionTitle: "same session", text: "Same session failure.", score: 0.85, evidence: [] },
  ],
};
const proposal = { rule: "Edit schema/api.yaml and run npm run generate; never edit src/client/generated.ts by hand.", rationale: "r", pattern: "hand edits to the generated client" };
const yes: GuardrailCheck = { samePattern: true, matchedIds: ["F1"], coveredBy: null, proposal };

describe("guardrailPrompt", () => {
  it("labels the new failure, earlier failures and existing Guardrails", () => {
    const p = guardrailPrompt(c, [{ _id: "g_1", rule: "r1", pattern: "p1", status: "rejected" }]);
    expect(p).toContain("N (session ses_new");
    expect(p).toContain("F1 (session ses_old: Add retries; similarity 0.88)");
    expect(p).toContain("G1 [rejected] r1 (pattern: p1)");
  });
});

describe("decideGuardrail", () => {
  it("proposes when the same failure appears in two Sessions and nothing covers it", () => {
    const d = decideGuardrail(yes, c, []);
    expect(d.propose).toBe(true);
    expect(d.matched.map((m) => m.memoryId)).toEqual(["mem_f1"]);
  });

  it("never counts two failures from the same Session", () => {
    expect(decideGuardrail({ ...yes, matchedIds: ["F2"] }, c, []).propose).toBe(false);
  });

  it("does not propose a pattern an existing Guardrail covers, even a rejected one", () => {
    const existing: ExistingGuardrail[] = [{ _id: "g_1", rule: proposal.rule, pattern: proposal.pattern, status: "rejected" }];
    const d = decideGuardrail({ ...yes, coveredBy: "G1" }, c, existing);
    expect(d.propose).toBe(false);
    expect(d.coveredBy?._id).toBe("g_1");
  });

  it("does not propose when the evidence shows a different failure", () => {
    expect(decideGuardrail({ ...yes, samePattern: false }, c, []).propose).toBe(false);
  });
});
