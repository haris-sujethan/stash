import { Command } from "commander";
import { login } from "./commands/login.js";
import { init } from "./commands/init.js";
import { push } from "./commands/push.js";
import { hookPush } from "./commands/hook.js";
import { pull } from "./commands/pull.js";
import { merge } from "./commands/merge.js";
import { guardrails } from "./commands/guardrails.js";
import { hooks } from "./commands/hooks.js";
import { sessions } from "./commands/sessions.js";
import { status } from "./commands/status.js";

export const VERSION = "0.1.0";


/** Every `stash` command and its options. */
export function buildProgram(): Command {
  const program = new Command().name("stash").description("Shared memory for AI coding agents.").version(VERSION);

  program.command("login").description("Save your Stash token").option("--token <token>").option("--api <url>", "API address (default http://localhost:3000)").action(login);
  program.command("init").description("Create or join the Project for this repository").option("--name <name>").action(init);
  program
    .command("push")
    .description("Capture this agent session, redact it locally, and publish it")
    .option("--session <id>", "push a specific session")
    .option("--llm <tool>", "AI tool for this run: claude, codex or cmd")
    .option("--events-only", "upload new events only (no Digest, Memories or Version)")
    .option("--transcript <path>", "push this session file directly")
    .option("--hook", "read a Claude Code hook event from stdin and push in the background")
    .action((opts: { hook?: boolean; eventsOnly?: boolean } & Parameters<typeof push>[0]) => (opts.hook ? hookPush(opts) : push(opts)));
  program
    .command("pull <id>")
    .description("Print a Briefing for a Session or Merge")
    .option("--budget <tokens>", "token budget (default 6000)")
    .option("--output <file>", "also write the Briefing to a file")
    .action(pull);
  program
    .command("merge <a> <b>")
    .description("Reconcile two Sessions into a Merge")
    .option("--llm <tool>", "AI tool for this run: claude, codex or cmd")
    .action(merge);
  program.command("sessions").description("List this Project's Sessions").action(sessions);
  program.command("status").description("Check the API, your token and the Project").action(status);
  program
    .command("hooks <action>")
    .description("Push automatically from Claude Code: install, uninstall or status")
    .option("--shared", "write .claude/settings.json (committed, for the whole team) instead of settings.local.json")
    .action(hooks);
  program.command("guardrails").description("List Guardrails (read-only; approve on the website)").action(guardrails);
  return program;
}
