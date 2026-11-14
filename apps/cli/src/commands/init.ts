import { git, readRepoConfig, repoRoot, requireUserConfig, UserError, writeRepoConfig } from "../config.js";
import { StashApi } from "../api.js";
import { ask, canPrompt } from "../prompt.js";
import { ok } from "../ui.js";

export async function init(opts: { name?: string }) {
  const user = await requireUserConfig();
  const root = repoRoot();
  const remote = git(["remote", "get-url", "origin"], root);
  let name = opts.name;
  if (!remote && !name) {
    if (!canPrompt()) throw new UserError("This repository has no git remote. Pass --name <project name>.");
    name = await ask("This repository has no git remote. Project name: ");
    if (!name) throw new UserError("A project name is required.");
  }
  const res = await StashApi.from(user).initProject(remote, name);
  const before = await readRepoConfig(root);
  await writeRepoConfig({ projectId: res.projectId, workspaceId: res.workspaceId, name: res.name, remote: res.remote }, root);
  ok(res.created ? "Created Project" : "Joined Project", `${res.name} (${res.projectId})`);
  if (res.remote) ok("Matched by remote", res.remote);
  if (!before) console.log("\nWrote .stash.json. Commit it so every clone joins the same Project.");
}
