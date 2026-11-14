// Guardrail proposals (BUILD.md 12.5): a failure that recurs in two or more Sessions becomes a Proposed
// Guardrail, which reaches agents only after a human approves it (ADR 0004).
import { z } from "zod";
import { EXTRACT_MARKER } from "./base.js";

export const GuardrailCheckSchema = z.object({
  samePattern: z.boolean().describe("True only if the evidence shows these are the same underlying failure."),
  matchedIds: z.array(z.string()).describe("Ids of the earlier failures (like F2) that are the same failure."),
  coveredBy: z.string().nullable().describe("Id of an existing Guardrail (like G1) that already covers this pattern, or null."),
  proposal: z
    .object({
      rule: z.string().describe("One imperative sentence an agent can follow, naming the right way to do it."),
      rationale: z.string().describe("Why, citing what went wrong in each session."),
      pattern: z.string().describe("A short neutral description of the recurring failure."),
    })
    .nullable(),
});
export type GuardrailCheck = z.infer<typeof GuardrailCheckSchema>;

export const GUARDRAIL_SYSTEM = `${EXTRACT_MARKER}
You decide whether a failure from a new coding-agent session is the same failure that happened in earlier sessions of the same project, and if so, draft a rule that would have prevented it.

You get the new failure (N) with its evidence, earlier failures (F1, F2…) from other sessions with their evidence and similarity scores, and the existing Guardrails (G1, G2…) with their status (proposed, approved or rejected).

Decide:
- samePattern: true only when the evidence shows the same underlying cause. Similar wording or the same file is not enough; judge what actually went wrong.
- matchedIds: the earlier failures that are the same failure.
- coveredBy: an existing Guardrail of any status that already covers this pattern. A rejected Guardrail still counts: a human decided against it.
- proposal: only when samePattern is true and nothing covers it. The rule is one imperative sentence that names the right way to do the work (for example "Edit schema/api.yaml and run npm run generate; never edit src/client/generated.ts by hand."). Otherwise null.`;

export interface FailureForCheck {
  memoryId: string;
  sessionId: string;
  sessionTitle: string;
  text: string;
  score?: number;
  evidence: { type: string; tool?: string; excerpt: string }[];
}

export interface GuardrailCandidates {
  failure: FailureForCheck;
  matches: FailureForCheck[];
}

export interface ExistingGuardrail {
  _id: string;
  rule: string;
  pattern: string;
  status: "proposed" | "approved" | "rejected";
}

const evidenceLines = (f: FailureForCheck) => f.evidence.map((e) => `    - ${e.type}${e.tool ? ` ${e.tool}` : ""}: ${e.excerpt}`);

export function guardrailPrompt(c: GuardrailCandidates, existing: ExistingGuardrail[]): string {
  return [
    `N (session ${c.failure.sessionId}: ${c.failure.sessionTitle}): ${c.failure.text}`,
    ...evidenceLines(c.failure),
    "",
    "Earlier failures in other sessions:",
    ...c.matches.flatMap((m, i) => [
      `F${i + 1} (session ${m.sessionId}: ${m.sessionTitle}; similarity ${(m.score ?? 0).toFixed(2)}): ${m.text}`,
      ...evidenceLines(m),
    ]),
    "",
    "Existing Guardrails:",
    ...(existing.length ? existing.map((g, i) => `G${i + 1} [${g.status}] ${g.rule} (pattern: ${g.pattern})`) : ["(none)"]),
  ].join("\n");
}

export interface GuardrailDecision {
  propose: boolean;
  matched: FailureForCheck[];
  coveredBy: ExistingGuardrail | null;
  proposal: { rule: string; rationale: string; pattern: string } | null;
}

/** Applies the rules the model can't be trusted to apply alone: 2+ distinct Sessions and no existing coverage. */
export function decideGuardrail(check: GuardrailCheck, c: GuardrailCandidates, existing: ExistingGuardrail[]): GuardrailDecision {
  const matched = check.matchedIds
    .map((id) => c.matches[Number(id.replace(/^F/i, "")) - 1])
    .filter((m): m is FailureForCheck => Boolean(m) && m!.sessionId !== c.failure.sessionId);
  const coveredBy = check.coveredBy ? (existing[Number(check.coveredBy.replace(/^G/i, "")) - 1] ?? null) : null;
  const sessions = new Set([c.failure.sessionId, ...matched.map((m) => m.sessionId)]);
  const propose = check.samePattern && !coveredBy && sessions.size >= 2 && Boolean(check.proposal?.rule.trim());
  return { propose, matched, coveredBy, proposal: propose ? check.proposal : null };
}
