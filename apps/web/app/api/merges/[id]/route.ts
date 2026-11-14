// GET /api/merges/:id: a Merge with its Findings and both sources' Memories.
import { collections } from "@/lib/db";
import { authenticate, HttpError, route, type Params } from "@/lib/http";

export const GET = route(async (req, ctx: Params<"id">) => {
  const caller = await authenticate(req);
  const { id } = await ctx.params;
  const c = await collections();
  const merge = await c.merges.findOne({ _id: id });
  if (!merge) throw new HttpError(404, `Merge ${id} not found.`);
  const project = await c.projects.findOne({ _id: merge.projectId, workspaceId: caller.workspaceId });
  if (!project) throw new HttpError(404, `Merge ${id} not found.`);
  const memories = await c.memories.find({ $or: merge.sources.map((s) => ({ sessionId: s.sessionId, version: s.version })) }).toArray();
  return Response.json({ merge, memories });
});
