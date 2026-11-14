// POST /api/sessions/:id/events: store a batch of Events. Ids are content hashes, so retries never duplicate.
import { UploadEventsRequest, type UploadEventsResponse } from "@stash/context-format";
import { collections } from "@/lib/db";
import { authenticate, body, route, sessionFor, type Params } from "@/lib/http";

export const POST = route(async (req, ctx: Params<"id">) => {
  const caller = await authenticate(req);
  const session = await sessionFor(caller, (await ctx.params).id);
  const { events } = await body(req, UploadEventsRequest);
  if (events.length === 0) return Response.json({ inserted: 0, duplicates: 0 } satisfies UploadEventsResponse);

  const c = await collections();
  const result = await c.events.bulkWrite(
    events.map((e) => ({
      updateOne: {
        filter: { _id: e._id },
        update: { $setOnInsert: { ...e, sessionId: session._id, projectId: session.projectId } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  const res: UploadEventsResponse = { inserted: result.upsertedCount, duplicates: events.length - result.upsertedCount };
  return Response.json(res);
});
