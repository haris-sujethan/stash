// POST /api/merges: store a Merge the CLI produced. It records the exact Versions used and never touches them.
import { z } from "zod";
import { Digest, ExtractedBy, FindingKind } from "@stash/context-format";
import { newId } from "@stash/core";
import { collections } from "@/lib/db";
import { audit, authenticate, body, HttpError, route } from "@/lib/http";

const StoreMerge = z.object({
  sources: z.array(z.object({ sessionId: z.string(), version: z.number().int().positive() })).length(2),
  digest: Digest,
  findings: z.array(z.object({ kind: FindingKind, summary: z.string(), memoryIds: z.array(z.string()), eventIds: z.array(z.string()) })).max(200),
  extractedBy: ExtractedBy,
});

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const input = await body(req, StoreMerge);
  const c = await collections();

  const sessions = await c.sessions.find({ _id: { $in: input.sources.map((s) => s.sessionId) }, workspaceId: caller.workspaceId }).toArray();
  if (sessions.length !== 2) throw new HttpError(404, "Both source Sessions must exist in your Workspace.");
  for (const s of input.sources) {
    const session = sessions.find((x) => x._id === s.sessionId)!;
    if (session.latestVersion !== s.version) {
      throw new HttpError(409, `${s.sessionId} has a newer Version (v${session.latestVersion}) than this Merge used (v${s.version}). Run stash merge again.`);
    }
  }
  // Every cited Memory must belong to one of the two source Versions.
  const allowed = await c.memories
    .find({ $or: input.sources.map((s) => ({ sessionId: s.sessionId, version: s.version })) }, { projection: { _id: 1, eventIds: 1 } })
    .toArray();
  const ok = new Set(allowed.map((m) => m._id));
  const okEvents = new Set(allowed.flatMap((m) => m.eventIds));
  const findings = input.findings
    .map((f) => ({ ...f, memoryIds: f.memoryIds.filter((id) => ok.has(id)), eventIds: f.eventIds.filter((id) => okEvents.has(id)) }))
    .filter((f) => f.memoryIds.length > 0);

  const merge = {
    _id: newId("merge"),
    projectId: sessions[0]!.projectId,
    sources: input.sources,
    digest: input.digest,
    findings,
    extractedBy: input.extractedBy,
    createdAt: new Date(),
  };
  await c.merges.insertOne(merge);
  await audit(caller, "merge.create", merge._id);
  const counts = Object.fromEntries(["duplicate", "complementary", "conflicting", "only_in_one"].map((k) => [k, findings.filter((f) => f.kind === k).length]));
  return Response.json({ mergeId: merge._id, counts }, { status: 201 });
});
