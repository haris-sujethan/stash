// POST /api/guardrails/:id/approve (header X-Approver-Secret). Approved rules lead every Briefing.
import { decideGuardrail } from "@/lib/decide";
import { route, type Params } from "@/lib/http";

export const POST = route(async (req, ctx: Params<"id">) => decideGuardrail(req, (await ctx.params).id, "approved"));
