// The approval boundary (ADR 0004): approving or rejecting a Guardrail and verifying a Memory need the approver
// secret, typed by a human into the website and sent as X-Approver-Secret. The server checks it on every request;
// hiding buttons is not the protection. The CLI has no way to do any of this.
import { collections } from "./db";
import { HttpError } from "./http";
import { verifyApproverSecret } from "./secrets";

export async function requireApprover(req: Request, projectId: string): Promise<{ workspaceId: string }> {
  const secret = req.headers.get("x-approver-secret") ?? "";
  if (!secret) throw new HttpError(401, "This action needs the approver secret.");
  const c = await collections();
  const project = await c.projects.findOne({ _id: projectId });
  const workspace = project ? await c.workspaces.findOne({ _id: project.workspaceId }) : null;
  if (!workspace || !verifyApproverSecret(secret, workspace.approverHash)) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing
    throw new HttpError(401, "Wrong approver secret.");
  }
  return { workspaceId: workspace._id };
}
