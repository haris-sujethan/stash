// POST /api/approver/check {projectId}: lets the website confirm the secret before the first action.
import { z } from "zod";
import { body, route } from "@/lib/http";
import { requireApprover } from "@/lib/approver";

export const POST = route(async (req) => {
  const { projectId } = await body(req.clone(), z.object({ projectId: z.string() }));
  await requireApprover(req, projectId);
  return Response.json({ ok: true });
});
