// Gathers what a Briefing needs from Atlas and records the pull (BUILD.md section 13). No LLM call.
import { buildBriefing, newId, type BriefingInput, type KeyEvent } from "@stash/core";
import type { Event } from "@stash/context-format";
import { collections } from "./db";
import { HttpError, type Caller } from "./http";
import { relatedForPull } from "./vector";

/** Up to 6 Events: errors and failing results first, then the most cited. */
export function pickKeyEvents(events: Event[], citations: Map<string, number>): KeyEvent[] {
  const weight = (e: Event) => (e.type === "error" ? 2 : e.tool?.isError ? 1 : 0);
  return [...events]
    .sort((a, b) => weight(b) - weight(a) || (citations.get(b._id) ?? 0) - (citations.get(a._id) ?? 0) || a.seq - b.seq)
    .slice(0, 6)
    .map((e) => ({
      _id: e._id,
      type: e.type,
      tool: e.tool?.name,
      excerpt: (e.output?.excerpt ?? e.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    }));
}

export async function pullSession(caller: Caller, sourceId: string, budget: number, agentSessionHint: string | null) {
  const c = await collections();
  if (sourceId.startsWith("m_")) return pullMerge(caller, sourceId, budget, agentSessionHint);
  const session = await c.sessions.findOne({ _id: sourceId, workspaceId: caller.workspaceId });
  if (!session) throw new HttpError(404, `Session ${sourceId} not found.`);
  if (session.latestVersion < 1) throw new HttpError(409, `${sourceId} has no processed Version yet. Run stash push again to process it.`);

  const [version, project, memories, guardrails] = await Promise.all([
    c.sessionVersions.findOne({ sessionId: session._id, version: session.latestVersion }),
    c.projects.findOne({ _id: session.projectId }),
    c.memories.find({ sessionId: session._id, current: true }).toArray(),
    c.guardrails.find({ projectId: session.projectId, status: "approved" }).sort({ decidedAt: 1 }).toArray(),
  ]);
  if (!version?.digest) throw new HttpError(409, `${sourceId} v${session.latestVersion} has no Digest.`);

  const citations = new Map<string, number>();
  for (const m of memories) for (const id of m.eventIds) citations.set(id, (citations.get(id) ?? 0) + 1);
  const [cited, hits] = await Promise.all([
    c.events.find({ _id: { $in: [...citations.keys()] } }).toArray(),
    relatedForPull(session.projectId, version.digest.objective, [session._id]),
  ]);
  const titles = new Map(
    (await c.sessions.find({ _id: { $in: [...new Set(hits.map((h) => h.sessionId))] } }, { projection: { title: 1 } }).toArray()).map((s) => [s._id, s.title]),
  );

  const pullId = newId("pull");
  const input: BriefingInput = {
    sourceId: session._id,
    version: version.version,
    pullId,
    projectName: project?.name ?? session.projectId,
    agent: session.agent,
    machine: session.machine,
    pushedAt: version.processedAt ?? version.createdAt,
    extractedBy: version.extractedBy,
    digest: version.digest,
    guardrails: guardrails.map((g) => ({ rule: g.rule })),
    memories,
    related: hits.map((h) => ({ ...h, sessionTitle: titles.get(h.sessionId) ?? "" })),
    keyEvents: pickKeyEvents(cited, citations),
  };
  const out = buildBriefing(input, budget);
  await c.pulls.insertOne({
    _id: pullId,
    projectId: session.projectId,
    sourceId: session._id,
    sourceType: "session",
    sourceVersion: version.version,
    budget,
    tokensUsed: out.tokens,
    relatedMemoryIds: out.relatedMemoryIds,
    agentSessionHint,
    createdAt: new Date(),
  });
  return { pullId, markdown: out.markdown, tokensUsed: out.tokens, related: out.relatedMemoryIds.length, dropped: out.dropped };
}

/** A Merge's Briefing: its Digest and Findings (conflicts first), approved Guardrails, and related Memories. */
async function pullMerge(caller: Caller, mergeId: string, budget: number, agentSessionHint: string | null) {
  const c = await collections();
  const merge = await c.merges.findOne({ _id: mergeId });
  const project = merge ? await c.projects.findOne({ _id: merge.projectId, workspaceId: caller.workspaceId }) : null;
  if (!merge || !project) throw new HttpError(404, `Merge ${mergeId} not found.`);
  const sourceIds = merge.sources.map((s) => s.sessionId);
  const [guardrails, hits] = await Promise.all([
    c.guardrails.find({ projectId: merge.projectId, status: "approved" }).sort({ decidedAt: 1 }).toArray(),
    relatedForPull(merge.projectId, merge.digest.objective, sourceIds),
  ]);
  const citations = new Map<string, number>();
  for (const f of merge.findings) for (const id of f.eventIds) citations.set(id, (citations.get(id) ?? 0) + (f.kind === "conflicting" ? 3 : 1));
  const [cited, sessions] = await Promise.all([
    c.events.find({ _id: { $in: [...citations.keys()] } }).toArray(),
    c.sessions.find({ _id: { $in: [...new Set(hits.map((h) => h.sessionId))] } }, { projection: { title: 1 } }).toArray(),
  ]);
  const titles = new Map(sessions.map((s) => [s._id, s.title]));
  const pullId = newId("pull");
  const out = buildBriefing(
    {
      sourceId: merge._id,
      version: 1,
      pullId,
      projectName: project.name,
      agent: "merge",
      machine: "",
      pushedAt: merge.createdAt,
      extractedBy: merge.extractedBy,
      digest: merge.digest,
      guardrails: guardrails.map((g) => ({ rule: g.rule })),
      memories: [],
      related: hits.map((h) => ({ ...h, sessionTitle: titles.get(h.sessionId) ?? "" })),
      keyEvents: pickKeyEvents(cited, citations),
      merge: { sources: merge.sources, findings: merge.findings },
    },
    budget,
  );
  await c.pulls.insertOne({
    _id: pullId,
    projectId: merge.projectId,
    sourceId: merge._id,
    sourceType: "merge",
    sourceVersion: 1,
    budget,
    tokensUsed: out.tokens,
    relatedMemoryIds: out.relatedMemoryIds,
    agentSessionHint,
    createdAt: new Date(),
  });
  return { pullId, markdown: out.markdown, tokensUsed: out.tokens, related: out.relatedMemoryIds.length, dropped: out.dropped };
}
