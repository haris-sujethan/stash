// Finds which Claude Code session to push. Never guesses silently.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { claudeProjectsDir, listSessionsIn, projectSlug, type SessionCandidate } from "@stash/agent-adapters";
import { UserError } from "./config.js";

export type Discovery =
  | { kind: "found"; candidate: SessionCandidate; how: "flag" | "env" | "only" }
  | { kind: "choose"; candidates: SessionCandidate[] };

async function findById(id: string): Promise<SessionCandidate | null> {
  const root = claudeProjectsDir();
  let dirs: string[] = [];
  try {
    dirs = await readdir(root);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const found = (await listSessionsIn(join(root, d))).find((c) => c.nativeSessionId === id);
    if (found) return found;
  }
  return null;
}

/** @param dirs working directories to look in (the cwd and the repo root) */
export async function discoverSession(opts: { flag?: string; env?: string; dirs: string[] }): Promise<Discovery> {
  if (opts.flag) {
    const c = await findById(opts.flag);
    if (!c) throw new UserError(`No Claude Code session ${opts.flag} on this machine.`);
    return { kind: "found", candidate: c, how: "flag" };
  }
  if (opts.env) {
    const c = await findById(opts.env);
    if (c) return { kind: "found", candidate: c, how: "env" };
  }
  const seen = new Map<string, SessionCandidate>();
  for (const dir of new Set(opts.dirs)) {
    for (const c of await listSessionsIn(join(claudeProjectsDir(), projectSlug(dir)))) seen.set(c.nativeSessionId, c);
  }
  const candidates = [...seen.values()].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  if (candidates.length === 0) throw new UserError("No Claude Code sessions found for this folder. Run stash push from inside Claude Code, or pass --session <id>.");
  if (candidates.length === 1) return { kind: "found", candidate: candidates[0]!, how: "only" };
  return { kind: "choose", candidates };
}

