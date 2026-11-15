// Prepares and stores Merges. The reasoning runs in the CLI with the developer's AI tool.
import type { Memory, Session } from "@stash/context-format";
import type { CandidatePair, EvidenceExcerpt, MergeSource, PreparedMerge } from "@stash/core";
import { collections } from "./db";
import { HttpError, type Caller } from "./http";
import { searchMemories } from "./vector";

/** Similarity at or above this makes a pair a merge candidate. Calibrated on Cluster0. */
export const MERGE_CANDIDATE_MIN = Number(process.env.MERGE_CANDIDATE_MIN ?? 0.82);

export async function loadSource(caller: Caller, sessionId: string): Promise<{ session: Session; source: MergeSource; memories: Memory[] }> {
  const c = await collections();
  const session = await c.sessions.findOne({ _id: sessionId, workspaceId: caller.workspaceId });
  if (!session) throw new HttpError(404, `Session ${sessionId} not found.`);
  if (session.latestVersion < 1) throw new HttpError(409, `${sessionId} has no processed Version yet. Push it first.`);
  const [version, memories] = await Promise.all([
    c.sessionVersions.findOne({ sessionId, version: session.latestVersion }),
    c.memories.find({ sessionId, current: true }).toArray(),
  ]);
  if (!version?.digest) throw new HttpError(409, `${sessionId} v${session.latestVersion} has no Digest.`);
  return {
    session,
    memories,
    source: {
      sessionId,
      version: version.version,
      title: session.title,
      digest: version.digest,
      memories: memories.map((m) => ({ _id: m._id, type: m.type, status: m.status, text: m.text, eventIds: m.eventIds })),
    },
  };
}

export async function prepareMerge(caller: Caller, a: string, b: string): Promise<PreparedMerge & { scores: number[] }> {
  if (a === b) throw new HttpError(400, "A Merge needs two different Sessions.");
  if (a.startsWith("m_") || b.startsWith("m_")) throw new HttpError(400, "A Merge can't be a source for another Merge.");
  const [A, B] = await Promise.all([loadSource(caller, a), loadSource(caller, b)]);
  if (A.session.projectId !== B.session.projectId) throw new HttpError(400, "Both Sessions must belong to the same Project.");

  // Candidate pairs: each Memory of A against B's current Memories.
  const scores: number[] = [];
  const pairs: CandidatePair[] = [];
  const hits = await Promise.all(
    A.memories.map((m) => searchMemories({ projectId: A.session.projectId, query: m.text, limit: 3, filter: { sessionId: b } })),
  );
  hits.forEach((list, i) => {
    for (const h of list) {
      scores.push(h.score);
      if (h.score >= MERGE_CANDIDATE_MIN) pairs.push({ a: A.memories[i]!._id, b: h._id, score: h.score });
    }
  });

  const c = await collections();
  const byId = new Map([...A.memories, ...B.memories].map((m) => [m._id, m]));
  const eventIds = [...new Set(pairs.flatMap((p) => [...(byId.get(p.a)?.eventIds ?? []), ...(byId.get(p.b)?.eventIds ?? [])]))].slice(0, 40);
  const events = await c.events.find({ _id: { $in: eventIds } }).toArray();
  const evidence: EvidenceExcerpt[] = events.map((e) => ({
    _id: e._id,
    type: e.type,
    tool: e.tool?.name,
    excerpt: (e.output?.excerpt ?? e.text ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
  }));
  return { a: A.source, b: B.source, pairs, evidence, scores };
}
