// Repeated-failure search for Guardrail proposals. The AI tool judges the evidence in the CLI.
import type { Event } from "@stash/context-format";
import type { ExistingGuardrail, FailureForCheck, GuardrailCandidates } from "@stash/core";
import { collections } from "./db";
import { HttpError, type Caller } from "./http";
import { searchMemories } from "./vector";

/** Matches at or above this go to the evidence check. Calibrated on Cluster0. */
export const GUARDRAIL_MATCH_MIN = Number(process.env.GUARDRAIL_MATCH_MIN ?? 0.7);

const excerpt = (e: Event) => ({
  type: e.type,
  tool: e.tool?.name,
  excerpt: (e.output?.excerpt ?? e.text ?? (e.file ? `${e.file.op} ${e.file.path}` : "")).replace(/\s+/g, " ").trim().slice(0, 300),
});

export async function guardrailCandidates(caller: Caller, sessionId: string, version: number) {
  const c = await collections();
  const session = await c.sessions.findOne({ _id: sessionId, workspaceId: caller.workspaceId });
  if (!session) throw new HttpError(404, `Session ${sessionId} not found.`);
  const failures = await c.memories.find({ sessionId, version, type: "failed_approach" }).toArray();

  const found = await Promise.all(
    failures.map((f) =>
      searchMemories({
        projectId: session.projectId,
        query: f.text,
        limit: 5,
        filter: { type: "failed_approach", sessionId: { $ne: sessionId } },
      }),
    ),
  );
  const scores = found.flat().map((h) => h.score);
  const kept = found.map((hits) => hits.filter((h) => h.score >= GUARDRAIL_MATCH_MIN));

  const allMemories = [...failures, ...kept.flat()];
  const eventIds = [...new Set(allMemories.flatMap((m) => m.eventIds.slice(0, 3)))];
  const sessionIds = [...new Set([sessionId, ...kept.flat().map((h) => h.sessionId)])];
  const [events, sessions, guardrails] = await Promise.all([
    c.events.find({ _id: { $in: eventIds } }).toArray(),
    c.sessions.find({ _id: { $in: sessionIds } }, { projection: { title: 1 } }).toArray(),
    c.guardrails.find({ projectId: session.projectId }).sort({ createdAt: 1 }).toArray(),
  ]);
  const ev = new Map(events.map((e) => [e._id, e]));
  const titles = new Map(sessions.map((s) => [s._id, s.title]));
  const toFailure = (m: { _id: string; sessionId: string; text: string; eventIds: string[] }, score?: number): FailureForCheck => ({
    memoryId: m._id,
    sessionId: m.sessionId,
    sessionTitle: titles.get(m.sessionId) ?? "",
    text: m.text,
    score,
    evidence: m.eventIds.slice(0, 3).flatMap((id) => (ev.has(id) ? [excerpt(ev.get(id)!)] : [])),
  });

  const candidates: GuardrailCandidates[] = failures
    .map((f, i) => ({ failure: toFailure(f), matches: kept[i]!.map((h) => toFailure(h, h.score)) }))
    .filter((x) => x.matches.length > 0);
  const existing: ExistingGuardrail[] = guardrails.map((g) => ({ _id: g._id, rule: g.rule, pattern: g.pattern, status: g.status }));
  return { candidates, existing, failures: failures.length, scores };
}
