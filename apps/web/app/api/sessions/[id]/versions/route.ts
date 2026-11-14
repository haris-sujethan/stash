// POST /api/sessions/:id/versions: record a Session Version, or report that nothing changed.
// Processing (Digest and Memories) runs in the CLI with the developer's AI tool from M5 (ADR 0005).
import { CreateVersionRequest, type CreateVersionResponse } from "@stash/context-format";
import { collections } from "@/lib/db";
import { audit, authenticate, body, HttpError, route, sessionFor, type Params } from "@/lib/http";

export const POST = route(async (req, ctx: Params<"id">) => {
  const caller = await authenticate(req);
  const session = await sessionFor(caller, (await ctx.params).id);
  const input = await body(req, CreateVersionRequest);
  const c = await collections();

  const stored = await c.events.countDocuments({ sessionId: session._id });
  if (stored < input.eventCount) {
    throw new HttpError(409, `Only ${stored} of ${input.eventCount} Events are stored. Upload them first.`);
  }

  const latest = await c.sessionVersions.findOne({ sessionId: session._id }, { sort: { version: -1 } });
  if (latest && latest.contentHash === input.contentHash) {
    const res: CreateVersionResponse = { unchanged: true, version: latest.version, status: latest.status };
    return Response.json(res);
  }

  const version = (latest?.version ?? 0) + 1;
  const now = new Date();
  await c.sessionVersions.insertOne({
    _id: `${session._id}@v${version}`,
    sessionId: session._id,
    projectId: session.projectId,
    version,
    eventCount: input.eventCount,
    contentHash: input.contentHash,
    status: "processing",
    digest: null,
    extractedBy: null,
    partial: false,
    redactedCount: input.redactedCount,
    createdAt: now,
    processedAt: null,
  });
  await c.sessions.updateOne({ _id: session._id }, { $set: { eventCount: input.eventCount, updatedAt: now } });
  await audit(caller, "version.create", `${session._id}@v${version}`);
  const res: CreateVersionResponse = { unchanged: false, version, status: "processing" };
  return Response.json(res, { status: 201 });
});
