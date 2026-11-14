// stash pull <id>: print a Briefing for a Session or Merge to stdout (BUILD.md section 13).
import { writeFile } from "node:fs/promises";
import { requireUserConfig, UserError } from "../config.js";
import { StashApi } from "../api.js";

export async function pull(id: string, opts: { budget?: string; output?: string }) {
  const user = await requireUserConfig();
  const budget = opts.budget ? Number(opts.budget) : undefined;
  if (budget !== undefined && (!Number.isInteger(budget) || budget < 500)) throw new UserError("--budget must be a whole number of tokens, at least 500.");
  const res = await StashApi.from(user).pull({ sourceId: id, budget, agentSessionHint: process.env.CLAUDE_CODE_SESSION_ID ?? null });
  process.stdout.write(res.markdown + "\n");
  if (opts.output) {
    await writeFile(opts.output, res.markdown + "\n");
    console.error(`Wrote ${opts.output} (${res.tokensUsed} tokens, ${res.related} related from other sessions).`);
  }
}
