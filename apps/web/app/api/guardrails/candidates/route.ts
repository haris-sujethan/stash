// GET /api/guardrails/candidates?sessionId=&version=: for each new Failed Approach, similar failures from other
// Sessions with their evidence, plus every Guardrail of the Project (any status).
import { guardrailCandidates } from "@/lib/guardrails";
import { authenticate, HttpError, route } from "@/lib/http";

export const GET = route(async (req) => {
  const caller = await authenticate(req);
  const q = new URL(req.url).searchParams;
  const sessionId = q.get("sessionId");
  const version = Number(q.get("version"));
  if (!sessionId || !Number.isInteger(version)) throw new HttpError(400, "sessionId and version are required.");
  return Response.json(await guardrailCandidates(caller, sessionId, version));
});
