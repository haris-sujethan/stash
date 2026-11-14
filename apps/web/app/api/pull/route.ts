// POST /api/pull: render a Briefing for a Session (Merges from M7). A fixed template plus one Vector Search.
import { z } from "zod";
import { DEFAULT_BUDGET } from "@stash/core";
import { pullSession } from "@/lib/briefing";
import { audit, authenticate, body, route } from "@/lib/http";

const PullRequest = z.object({
  sourceId: z.string().min(3),
  budget: z.number().int().min(500).max(200_000).optional(),
  agentSessionHint: z.string().max(100).nullable().optional(),
});

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const input = await body(req, PullRequest);
  const res = await pullSession(caller, input.sourceId, input.budget ?? DEFAULT_BUDGET, input.agentSessionHint ?? null);
  await audit(caller, "pull", `${input.sourceId} ${res.pullId}`);
  return Response.json(res);
});
