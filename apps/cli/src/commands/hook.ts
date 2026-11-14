// `stash push --hook`: the entry point Claude Code hooks call (see `stash hooks install`).
// It reads the hook's JSON from stdin, hands the real work to a detached background process, and returns at once,
// so the agent is never slowed down and a failure never breaks the session. Output goes to ~/.stash/logs.
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, join } from "node:path";
import { readRepoConfig, readUserConfig, repoRoot, userConfigPath } from "../config.js";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

export async function hookPush(opts: { eventsOnly?: boolean }) {
  // Stash's own reasoning calls run `claude -p`, which fires hooks too; they must never push themselves.
  if (process.env.STASH_INTERNAL === "1") return;
  let input: HookInput = {};
  try {
    input = JSON.parse((await readStdin()) || "{}") as HookInput;
  } catch {
    return;
  }
  const cwd = input.cwd ?? process.cwd();
  const transcript = input.transcript_path;
  if (!transcript) return;
  // Quietly do nothing where Stash isn't set up, so the hook is harmless in any repo.
  const [user, repo] = await Promise.all([readUserConfig(), readRepoConfig(repoRoot(cwd))]);
  if (!user?.token || !repo) return;

  const logDir = join(dirname(userConfigPath()), "logs");
  mkdirSync(logDir, { recursive: true });
  const log = openSync(join(logDir, `${new Date().toISOString().slice(0, 10)}.log`), "a");
  const args = [process.argv[1]!, "push", "--transcript", transcript, ...(opts.eventsOnly ? ["--events-only"] : [])];
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, STASH_HOOK_EVENT: input.hook_event_name ?? "", FORCE_COLOR: "0" },
  });
  child.unref();
}
