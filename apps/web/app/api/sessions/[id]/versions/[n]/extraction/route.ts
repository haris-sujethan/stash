// POST /api/sessions/:id/versions/:n/extraction: store the Digest and Memories the developer's AI tool produced
// for this Version, after checking every citation again, then make them the Session's current Memories.
import { z } from "zod";
import { ExtractedBy, type EventType, type Memory } from "@stash/context-format";
import { ExtractSchema, newId, validateExtraction } from "@stash/core";
import { collections } from "@/lib/db";
import { audit, authenticate, body, HttpError, route, sessionFor, type Params } from "@/lib/http";

const SubmitExtraction = ExtractSchema.extend({ extractedBy: ExtractedBy, partial: z.boolean() });

export const POST = route(async (req, ctx: Params<"id" | "n">) => {
  const caller = await authenticate(req);
  const { id, n } = await ctx.params;
  const session = await sessionFor(caller, id);
  const version = Number(n);
  const input = await body(req, SubmitExtraction);
  const c = await collections();

  const v = await c.sessionVersions.findOne({ sessionId: session._id, version });
  if (!v) throw new HttpError(404, `Version ${version} of ${session._id} not found.`);
  if (v.status === "processed") throw new HttpError(409, `Version ${version} is already processed.`);

  const types = new Map<string, EventType>();
  for await (const e of c.events.find({ sessionId: session._id }, { projection: { _id: 1, type: 1 } })) types.set(e._id, e.type);
  const valid = validateExtraction(input, types);

  const now = new Date();
  const docs: Memory[] = valid.memories.map((m) => ({
    _id: newId("memory"),
    projectId: session.projectId,
    sessionId: session._id,
    version,
    type: m.type,
    text: m.text,
    status: m.status,
    eventIds: m.eventIds,
    current: false,
    createdAt: now,
  }));
  // A retried submission replaces its own earlier, not-yet-current attempt.
  await c.memories.deleteMany({ sessionId: session._id, version, current: false });
  if (docs.length) await c.memories.insertMany(docs);
  await c.sessionVersions.updateOne(
    { _id: v._id },
    { $set: { digest: valid.digest, extractedBy: input.extractedBy, partial: input.partial, status: "processed", processedAt: now }, $unset: { error: "" } },
  );

  // Only a newer Version takes over; reprocessing an older one never replaces the current set.
  if (version >= session.latestVersion) {
    await c.memories.updateMany({ sessionId: session._id, current: true, version: { $ne: version } }, { $set: { current: false } });
    await c.memories.updateMany({ sessionId: session._id, version }, { $set: { current: true } });
    await c.sessions.updateOne({ _id: session._id }, { $set: { latestVersion: version, updatedAt: now } });
  }
  await audit(caller, "version.process", v._id);
  return Response.json({ version, memories: docs.length, dropped: valid.dropped, downgraded: valid.downgraded });
});
