// Runs the developer's own AI tool for reasoning steps (ADR 0005, BUILD.md section 12).
import { adapterFor, claudeAdapter, codexAdapter, DEFAULT_TIMEOUT_MS, runningInside, runStructured, type LlmAdapter, type LlmTool } from "@stash/llm-adapters";
import { EXTRACT_SYSTEM, ExtractSchema, extractPrompt, renderTranscript, validateExtraction, type TranscriptEvent } from "@stash/core";
import type { EventType, ExtractedBy } from "@stash/context-format";
import { UserError, writeUserConfig, type UserConfig } from "./config.js";
import { ask, canPrompt } from "./prompt.js";

const TOOLS: LlmTool[] = ["claude", "codex", "cmd"];

/** --llm flag, else the agent Stash runs inside, else the saved choice, else detect and ask once. */
export async function chooseAdapter(user: UserConfig, flag?: string): Promise<LlmAdapter> {
  let llm = user.llm ?? {};
  const save = async (tool: LlmTool, extra: Partial<NonNullable<UserConfig["llm"]>> = {}) => {
    llm = { ...llm, ...extra, tool };
    await writeUserConfig({ ...user, llm });
  };

  if (flag) {
    if (!TOOLS.includes(flag as LlmTool)) throw new UserError(`--llm must be one of ${TOOLS.join(", ")}.`);
    const tool = flag as LlmTool;
    if (tool === "cmd" && !llm.command) {
      if (!canPrompt()) throw new UserError("No AI command saved. Run once in a terminal: stash push --llm cmd");
      const command = await ask("Command that reads a prompt on stdin and prints the answer (e.g. ollama run qwen3): ");
      if (!command) throw new UserError("No command given.");
      await save("cmd", { command });
    }
    return adapterFor(tool, llm);
  }

  const inside = runningInside();
  if (inside) return adapterFor(inside, llm);
  if (llm.tool) return adapterFor(llm.tool, llm);

  const installed: LlmTool[] = [];
  if (await claudeAdapter().detect()) installed.push("claude");
  if (await codexAdapter().detect()) installed.push("codex");
  if (installed.length === 0) {
    throw new UserError("No AI tool found. Install Claude Code or Codex, or set any command with: stash push --llm cmd");
  }
  let tool = installed[0]!;
  if (installed.length > 1 && canPrompt()) {
    const pick = await ask(`Which AI tool should Stash use? [${installed.join("/")}] `);
    if (installed.includes(pick as LlmTool)) tool = pick as LlmTool;
  }
  await save(tool);
  return adapterFor(tool, llm);
}

export interface ExtractInput {
  title: string;
  gitBranch: string | null;
  events: (TranscriptEvent & { type: EventType })[];
}

export async function extractLocally(adapter: LlmAdapter, input: ExtractInput) {
  const transcript = renderTranscript(input.events, adapter.maxInputTokens);
  const { value, model } = await runStructured(
    adapter,
    { system: EXTRACT_SYSTEM, prompt: extractPrompt(transcript, input), timeoutMs: DEFAULT_TIMEOUT_MS },
    ExtractSchema,
  );
  const types = new Map(input.events.map((e) => [e._id, e.type]));
  const valid = validateExtraction(value, types, transcript.aliases);
  const extractedBy: ExtractedBy = { tool: adapter.tool, model };
  return { valid, extractedBy, partial: transcript.partial, omitted: transcript.omitted, tokens: transcript.tokens };
}
