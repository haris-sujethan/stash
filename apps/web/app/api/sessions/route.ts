// GET /api/sessions?projectId=: the Project's Sessions, newest first.
import type { SessionSummary } from "@stash/context-format";
import { collections } from "@/lib/db";
import { authenticate, HttpError, projectFor, route } from "@/lib/http";

export const GET = route(async (req) => {
  const caller = await authenticate(req);
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) throw new HttpError(400, "projectId is required.");
  await projectFor(caller, projectId);
  const c = await collections();
  const sessions = await c.sessions.find({ projectId }).sort({ updatedAt: -1 }).limit(100).toArray();
  const ids = sessions.map((s) => s._id);
  const [versions, memories] = await Promise.all([
    c.sessionVersions.aggregate<{ _id: string; n: number }>([{ $match: { sessionId: { $in: ids } } }, { $group: { _id: "$sessionId", n: { $sum: 1 } } }]).toArray(),
    c.memories.aggregate<{ _id: string; n: number }>([{ $match: { sessionId: { $in: ids }, current: true } }, { $group: { _id: "$sessionId", n: { $sum: 1 } } }]).toArray(),
  ]);
  const vCount = new Map(versions.map((v) => [v._id, v.n]));
  const mCount = new Map(memories.map((m) => [m._id, m.n]));
  const out: SessionSummary[] = sessions.map((s) => ({
    _id: s._id,
    title: s.title,
    agent: s.agent,
    machine: s.machine,
    latestVersion: s.latestVersion,
    versions: vCount.get(s._id) ?? 0,
    eventCount: s.eventCount,
    memoryCount: mCount.get(s._id) ?? 0,
    updatedAt: s.updatedAt.toISOString(),
  }));
  return Response.json({ sessions: out });
});
