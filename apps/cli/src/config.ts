// ~/.stash/config.json (per user, holds the token) and .stash.json (per repo, committed).
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

export interface UserConfig {
  apiUrl: string;
  token: string;
  llm?: { tool?: "claude" | "codex" | "cmd"; model?: string | null; command?: string | null; maxInputTokens?: number | null };
}

export interface RepoConfig {
  projectId: string;
  workspaceId: string;
  name: string;
  remote: string | null;
}

export class UserError extends Error {}

export const userConfigPath = () => join(process.env.STASH_HOME ?? join(homedir(), ".stash"), "config.json");
export const DEFAULT_API = "http://localhost:3000";

export async function readUserConfig(): Promise<UserConfig | null> {
  try {
    return JSON.parse(await readFile(userConfigPath(), "utf8")) as UserConfig;
  } catch {
    return null;
  }
}

export async function requireUserConfig(): Promise<UserConfig> {
  const c = await readUserConfig();
  if (!c?.token) throw new UserError("Not logged in. Run `stash login`.");
  return c;
}

export async function writeUserConfig(c: UserConfig): Promise<void> {
  const path = userConfigPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(c, null, 2) + "\n", { mode: 0o600 });
  await chmod(path, 0o600);
}

/** The git repository root, or the working directory when this is not a git repository. */
export function repoRoot(cwd = process.cwd()): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return cwd;
  }
}

export function git(args: string[], cwd = process.cwd()): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

export const repoConfigPath = (root = repoRoot()) => join(root, ".stash.json");

export async function readRepoConfig(root = repoRoot()): Promise<RepoConfig | null> {
  try {
    return JSON.parse(await readFile(repoConfigPath(root), "utf8")) as RepoConfig;
  } catch {
    return null;
  }
}

export async function requireRepoConfig(root = repoRoot()): Promise<RepoConfig> {
  const c = await readRepoConfig(root);
  if (!c) throw new UserError("This repository isn't set up for Stash. Run `stash init`.");
  return c;
}

export async function writeRepoConfig(c: RepoConfig, root = repoRoot()): Promise<void> {
  await writeFile(repoConfigPath(root), JSON.stringify(c, null, 2) + "\n");
}
