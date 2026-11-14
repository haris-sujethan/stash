// GET /api/guardrails?projectId=&status=  and  POST /api/guardrails (a Proposed Guardrail from the CLI).
// Approval happens only on the website with the approver secret (ADR 0004); nothing here approves.
import { z } from "zod";
import { ExtractedBy } from "@stash/context-format";
import { newId } from "@stash/core";
import { collections } from "@/lib/db";
import { audit, authenticate, body, HttpError, projectFor, route } from "@/lib/http";

export const GET = route(async (req) => {
  const caller = await authenticate(req);
  const q = new URL(req.url).searchParams;
  const projectId = q.get("projectId");
  if (!projectId) throw new HttpError(400, "projectId is required.");
  await projectFor(caller, projectId);
  const status = q.get("status");
  const c = await collections();
  const guardrails = await c.guardrails
    .find({ projectId, ...(status ? { status: status as "proposed" | "approved" | "rejected" } : {}) })
    .sort({ createdAt: -1 })
    .toArray();
  return Response.json({ guardrails });
});

const Propose = z.object({
  rule: z.string().min(5).max(500),
  rationale: z.string().max(2000),
  pattern: z.string().min(3).max(300),
  evidence: z.array(z.object({ sessionId: z.string(), memoryId: z.string(), eventIds: z.array(z.string()) })).min(2).max(20),
  extractedBy: ExtractedBy,
});

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const input = await body(req, Propose);
  const c = await collections();

  const memories = await c.memories.find({ _id: { $in: input.evidence.map((e) => e.memoryId) } }).toArray();
  const byId = new Map(memories.map((m) => [m._id, m]));
  const evidence = input.evidence.filter((e) => byId.get(e.memoryId)?.sessionId === e.sessionId);
  const projects = new Set(evidence.map((e) => byId.get(e.memoryId)!.projectId));
  if (projects.size !== 1) throw new HttpError(422, "Evidence must come from one Project.");
  const projectId = [...projects][0]!;
  await projectFor(caller, projectId);
  if (new Set(evidence.map((e) => e.sessionId)).size < 2) {
    throw new HttpError(422, "A Guardrail needs evidence from at least two different Sessions.");
  }
  const cleaned = evidence.map((e) => {
    const own = byId.get(e.memoryId)!.eventIds;
    const given = e.eventIds.filter((id) => own.includes(id));
    return { ...e, eventIds: given.length ? given : own };
  });

  const guardrail = {
    _id: newId("guardrail"),
    projectId,
    rule: input.rule.trim(),
    rationale: input.rationale.trim(),
    status: "proposed" as const,
    evidence: cleaned,
    pattern: input.pattern.trim(),
    extractedBy: input.extractedBy,
    createdAt: new Date(),
  };
  await c.guardrails.insertOne(guardrail);
  await audit(caller, "guardrail.propose", guardrail._id);
  return Response.json({ guardrail }, { status: 201 });
});
