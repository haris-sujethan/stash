// POST /api/merges/prepare: both Sessions' latest processed Versions, their Memories and the Vector Search
// candidate pairs, for the CLI to reconcile with the developer's AI tool.
import { z } from "zod";
import { prepareMerge } from "@/lib/merge";
import { authenticate, body, route } from "@/lib/http";

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const { a, b } = await body(req, z.object({ a: z.string(), b: z.string() }));
  return Response.json(await prepareMerge(caller, a, b));
});
