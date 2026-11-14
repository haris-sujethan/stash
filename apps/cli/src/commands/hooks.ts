// stash hooks install | uninstall | status: wire Stash into Claude Code for this repository.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { readRepoConfig, repoRoot, requireUserConfig, UserError } from "../config.js";
import { hooksInstalled, installHooks, uninstallHooks, type Settings } from "../hooks.js";
import { ok, warn } from "../ui.js";

function settingsPath(root: string, shared: boolean) {
  return join(root, ".claude", shared ? "settings.json" : "settings.local.json");
}

async function readSettings(path: string): Promise<Settings> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Settings;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new UserError(`${path} isn't valid JSON, so it was left alone.`);
  }
}

async function writeSettings(path: string, s: Settings) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(s, null, 2) + "\n");
}

export async function hooks(action: string, opts: { shared?: boolean }) {
  const root = repoRoot();
  const path = settingsPath(root, Boolean(opts.shared));
  const rel = relative(process.cwd(), path) || path;
  if (action === "install") {
    await requireUserConfig();
    if (!(await readRepoConfig(root))) throw new UserError("Run `stash init` in this repository first.");
    await writeSettings(path, installHooks(await readSettings(path)));
    ok("Hooks installed", rel);
    console.log("\nFrom the next Claude Code session in this repository:");
    console.log("  • after every agent turn, Stash uploads the new events (no AI call, in the background)");
    console.log("  • when the session ends, Stash does a full push: Digest, Memories, Guardrails, lineage");
    console.log(`Logs: ~/.stash/logs.  ${opts.shared ? "Commit this file so teammates get the hooks." : "This file is personal (git-ignored by Claude Code)."}`);
  } else if (action === "uninstall") {
    await writeSettings(path, uninstallHooks(await readSettings(path)));
    ok("Hooks removed", rel);
  } else if (action === "status") {
    for (const shared of [false, true]) {
      const p = settingsPath(root, shared);
      const s = hooksInstalled(await readSettings(p));
      (s.Stop && s.SessionEnd ? ok : warn)(shared ? "Shared hooks" : "Personal hooks", `${relative(process.cwd(), p)}: after each turn ${s.Stop ? "on" : "off"}, at session end ${s.SessionEnd ? "on" : "off"}`);
    }
  } else {
    throw new UserError("Use: stash hooks install | uninstall | status");
  }
}
