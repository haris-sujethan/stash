// POST /api/guardrails/:id/reject (header X-Approver-Secret). A rejected pattern is never proposed again.
import { decideGuardrail } from "@/lib/decide";
import { route, type Params } from "@/lib/http";

export const POST = route(async (req, ctx: Params<"id">) => decideGuardrail(req, (await ctx.params).id, "rejected"));
