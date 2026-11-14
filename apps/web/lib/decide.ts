import { collections } from "./db";
import { audit, HttpError } from "./http";
import { requireApprover } from "./approver";

export async function decideGuardrail(req: Request, id: string, status: "approved" | "rejected") {
  const c = await collections();
  const g = await c.guardrails.findOne({ _id: id });
  if (!g) throw new HttpError(404, `Guardrail ${id} not found.`);
  const { workspaceId } = await requireApprover(req, g.projectId);
  if (g.status !== "proposed") throw new HttpError(409, `This Guardrail was already ${g.status}.`);
  const decidedAt = new Date();
  await c.guardrails.updateOne({ _id: id, status: "proposed" }, { $set: { status, decidedAt } });
  await audit({ workspaceId, tokenId: "approver" }, `guardrail.${status === "approved" ? "approve" : "reject"}`, id, "approver");
  return Response.json({ guardrail: { ...g, status, decidedAt } });
}
