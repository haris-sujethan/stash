import { requireRepoConfig, requireUserConfig } from "../config.js";
import { StashApi } from "../api.js";
import { ago } from "../ui.js";

export async function sessions() {
  const user = await requireUserConfig();
  const repo = await requireRepoConfig();
  const { sessions } = await StashApi.from(user).sessions(repo.projectId);
  if (sessions.length === 0) return console.log(`No Sessions in ${repo.name} yet. Run stash push.`);
  const rows = sessions.map((s) => [s._id, s.agent, `v${s.versions}`, String(s.eventCount), String(s.memoryCount), s.machine.replace(/\.local$/, ""), ago(s.updatedAt), s.title.slice(0, 48)]);
  const head = ["ID", "AGENT", "VER", "EVENTS", "MEMORIES", "MACHINE", "UPDATED", "TITLE"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  for (const r of [head, ...rows]) console.log(r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]!))).join("  "));
}
