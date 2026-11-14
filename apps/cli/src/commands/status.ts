import { readRepoConfig, readUserConfig, repoRoot } from "../config.js";
import { StashApi } from "../api.js";
import { ok, warn } from "../ui.js";

export async function status() {
  const user = await readUserConfig();
  if (!user?.token) warn("Login", "not logged in (stash login)");
  const api = new StashApi(user?.apiUrl ?? "http://localhost:3000", user?.token, []);
  const s = await api.status();
  ok("API", user?.apiUrl ?? "http://localhost:3000");
  (s.db === "ok" ? ok : warn)("Database", s.db);
  (s.index === "READY" && s.indexQueryable ? ok : warn)("Vector Search index", `${s.index ?? "unknown"}${s.index === "READY" ? "" : " (if embedding is paused, turn on storage auto-scaling)"}`);
  if (user?.token) (s.auth === "ok" ? ok : warn)("Token", s.auth === "ok" ? `valid for ${s.workspaceId}` : "rejected (stash login)");
  const repo = await readRepoConfig(repoRoot());
  if (repo) ok("Project", `${repo.name} (${repo.projectId})`);
  else warn("Project", "not set up here (stash init)");
}
