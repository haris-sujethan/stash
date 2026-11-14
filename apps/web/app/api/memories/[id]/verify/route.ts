// POST /api/memories/:id/verify (header X-Approver-Secret). Only a human can make a Memory Verified.
import { collections } from "@/lib/db";
import { audit, HttpError, route, type Params } from "@/lib/http";
import { requireApprover } from "@/lib/approver";

export const POST = route(async (req, ctx: Params<"id">) => {
  const { id } = await ctx.params;
  const c = await collections();
  const m = await c.memories.findOne({ _id: id });
  if (!m) throw new HttpError(404, `Memory ${id} not found.`);
  const { workspaceId } = await requireApprover(req, m.projectId);
  const verifiedAt = new Date();
  await c.memories.updateOne({ _id: id }, { $set: { status: "verified", verifiedAt } });
  await audit({ workspaceId, tokenId: "approver" }, "memory.verify", id, "approver");
  return Response.json({ memory: { ...m, status: "verified", verifiedAt } });
});
