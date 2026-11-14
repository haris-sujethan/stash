import { Command } from "commander";
import { login } from "./commands/login.js";
import { init } from "./commands/init.js";
import { push } from "./commands/push.js";
import { pull } from "./commands/pull.js";
import { sessions } from "./commands/sessions.js";
import { status } from "./commands/status.js";

export const VERSION = "0.1.0";

const notYet = (milestone: string) => () => {
  console.error(`Not built yet (lands in ${milestone}).`);
  process.exitCode = 1;
};

/** The whole command surface from MVP.md. Commands are filled in milestone by milestone. */
export function buildProgram(): Command {
  const program = new Command().name("stash").description("Shared memory for AI coding agents.").version(VERSION);

  program.command("login").description("Save your Stash token").option("--token <token>").option("--api <url>", "API address (default http://localhost:3000)").action(login);
  program.command("init").description("Create or join the Project for this repository").option("--name <name>").action(init);
  program
    .command("push")
    .description("Capture this agent session, redact it locally, and publish it")
    .option("--session <id>", "push a specific session")
    .option("--llm <tool>", "AI tool for this run: claude, codex or cmd")
    .action(push);
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
    .action(notYet("M7"));
  program.command("sessions").description("List this Project's Sessions").action(sessions);
  program.command("status").description("Check the API, your token and the Project").action(status);
  program.command("guardrails").description("List Guardrails (read-only; approve on the website)").action(notYet("M8"));
  return program;
}
