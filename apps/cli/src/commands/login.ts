import { DEFAULT_API, readUserConfig, UserError, writeUserConfig } from "../config.js";
import { StashApi } from "../api.js";
import { askHidden } from "../prompt.js";
import { ok } from "../ui.js";

export async function login(opts: { token?: string; api?: string }) {
  const existing = await readUserConfig();
  const apiUrl = opts.api ?? existing?.apiUrl ?? DEFAULT_API;
  const token = opts.token ?? (await askHidden("Stash token (from the seed): "));
  if (!/^stash_[0-9A-Za-z]{32}$/.test(token)) throw new UserError("That doesn't look like a Stash token (stash_ followed by 32 letters and digits).");
  const status = await new StashApi(apiUrl, token).status();
  if (status.auth !== "ok") throw new UserError("The API rejected that token.");
  await writeUserConfig({ ...existing, apiUrl, token });
  ok("Logged in", `${status.workspaceId} at ${apiUrl}`);
}
