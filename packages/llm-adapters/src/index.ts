// Running the developer's own AI tool for every reasoning step (ADR 0005, BUILD.md 12.1 and 12.2).
// Each adapter spawns a command-line tool directly (never through a shell), sends the prompt on stdin,
// and returns the tool's answer. runStructured() checks the answer against a zod schema, with one retry.
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export type LlmTool = "claude" | "codex" | "cmd";

export interface LlmRequest {
  system: string;
  prompt: string;
  /** JSON Schema, from z.toJSONSchema(ZodSchema). */
  schema: object;
  timeoutMs: number;
}

export interface LlmResult {
  text: string;
  model: string | null;
}

export interface LlmAdapter {
  tool: LlmTool;
  /** Shown in progress lines, e.g. "claude (sonnet)". */
  label: string;
  maxInputTokens: number;
  detect(): Promise<boolean>;
  run(req: LlmRequest): Promise<LlmResult>;
}

export const DEFAULT_TIMEOUT_MS = 600_000;

export class LlmError extends Error {}

// ---------- process helper ----------

export interface RunOutput { code: number | null; stdout: string; stderr: string }

export function runProcess(cmd: string, args: string[], input: string, timeoutMs: number, cwd = tmpdir()): Promise<RunOutput> {
  return new Promise((resolve, reject) => {
    // STASH_INTERNAL tells Stash's own hooks to ignore this process (e.g. `claude -p` fires Stop and SessionEnd too).
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, STASH_INTERNAL: "1" } });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new LlmError(`${cmd} did not answer within ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new LlmError(`Could not start ${cmd}: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

/**
 * Finds a tool's executable: on PATH first, then the folders its installers use, because a terminal's PATH
 * often lacks them (Claude Code installs to ~/.local/bin, which many shells don't include).
 */
export function findExecutable(name: string, extraDirs: string[] = []): string | null {
  const dirs = [...(process.env.PATH ?? "").split(":"), ...extraDirs].filter(Boolean);
  for (const dir of dirs) {
    const path = join(dir, name);
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      /* not here */
    }
  }
  return null;
}

const INSTALL_DIRS = () => [join(homedir(), ".local/bin"), join(homedir(), ".claude/local"), "/opt/homebrew/bin", "/usr/local/bin", join(homedir(), ".npm-global/bin")];

const onPath = async (cmd: string) => {
  try {
    const out = await runProcess(cmd, ["--version"], "", 15_000);
    return out.code === 0;
  } catch {
    return false;
  }
};

/** Splits a saved command like `ollama run "qwen3:8b"` into argv without a shell. */
export function splitCommand(command: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

/** The first complete JSON object in free text (for tools without structured output). */
export function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// ---------- adapters ----------

/**
 * Claude Code in headless mode. --no-session-persistence keeps Stash's own calls out of the session list,
 * and tools are off so the call can only answer. Verified against Claude Code 2.1.318.
 */
export function claudeAdapter(opts: { model?: string | null; command?: string } = {}): LlmAdapter {
  const cmd = opts.command ?? findExecutable("claude", INSTALL_DIRS()) ?? "claude";
  const model = opts.model ?? "sonnet";
  return {
    tool: "claude",
    label: `claude (${model})`,
    maxInputTokens: 150_000,
    detect: () => onPath(cmd),
    async run(req) {
      const args = [
        "-p", "--output-format", "json",
        "--json-schema", JSON.stringify(req.schema),
        "--no-session-persistence",
        "--model", model,
        "--tools", "",
        "--strict-mcp-config",
        "--settings", JSON.stringify({ disableAllHooks: true }),
        "--system-prompt", req.system,
      ];
      const out = await runProcess(cmd, args, req.prompt, req.timeoutMs);
      let env: { is_error?: boolean; result?: string; structured_output?: unknown; modelUsage?: Record<string, unknown> };
      try {
        env = JSON.parse(out.stdout);
      } catch {
        throw new LlmError(`claude exited with ${out.code} and no JSON answer.${out.stderr ? ` ${out.stderr.slice(0, 300)}` : ""}`);
      }
      if (env.is_error) throw new LlmError(`claude reported an error: ${String(env.result ?? "").slice(0, 300)}`);
      const text = env.structured_output !== undefined ? JSON.stringify(env.structured_output) : String(env.result ?? "");
      return { text, model: Object.keys(env.modelUsage ?? {})[0] ?? model };
    },
  };
}

/** OpenAI Codex CLI. Flags follow `codex exec --help`; confirm them on a machine with Codex installed. */
export function codexAdapter(opts: { model?: string | null; command?: string } = {}): LlmAdapter {
  const cmd = opts.command ?? findExecutable("codex", INSTALL_DIRS()) ?? "codex";
  return {
    tool: "codex",
    label: `codex${opts.model ? ` (${opts.model})` : ""}`,
    maxInputTokens: 150_000,
    detect: () => onPath(cmd),
    async run(req) {
      const dir = await mkdtemp(join(tmpdir(), "stash-codex-"));
      try {
        const schemaPath = join(dir, "schema.json");
        const outPath = join(dir, "out.json");
        await writeFile(schemaPath, JSON.stringify(req.schema));
        const args = ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "--output-schema", schemaPath, "-o", outPath];
        if (opts.model) args.push("-m", opts.model);
        args.push("-");
        const out = await runProcess(cmd, args, `${req.system}\n\n${req.prompt}`, req.timeoutMs, dir);
        if (out.code !== 0) throw new LlmError(`codex exited with ${out.code}.${out.stderr ? ` ${out.stderr.slice(0, 300)}` : ""}`);
        return { text: await readFile(outPath, "utf8"), model: opts.model ?? null };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Any command that reads a prompt on stdin and prints an answer, e.g. `ollama run qwen3`. */
export function commandAdapter(opts: { command: string; model?: string | null; maxInputTokens?: number | null }): LlmAdapter {
  const [cmd, ...baseArgs] = splitCommand(opts.command);
  if (!cmd) throw new LlmError("The AI command is empty.");
  return {
    tool: "cmd",
    label: `cmd (${opts.command})`,
    maxInputTokens: opts.maxInputTokens ?? 24_000,
    detect: async () => true,
    async run(req) {
      const input = [
        req.system,
        "Reply with one JSON object that matches this JSON Schema, and nothing else:",
        JSON.stringify(req.schema),
        "",
        req.prompt,
      ].join("\n");
      const out = await runProcess(cmd, baseArgs, input, req.timeoutMs);
      if (out.code !== 0) throw new LlmError(`${cmd} exited with ${out.code}.${out.stderr ? ` ${out.stderr.slice(0, 300)}` : ""}`);
      const json = firstJsonObject(out.stdout);
      if (!json) throw new LlmError(`${cmd} did not print a JSON object.`);
      return { text: json, model: opts.model ?? null };
    },
  };
}

// ---------- structured calls ----------

export function jsonSchemaFor(schema: z.ZodType): object {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return rest;
}

/** Runs the adapter, parses and validates the answer, and retries once with the validation error. */
export async function runStructured<S extends z.ZodType>(
  adapter: LlmAdapter,
  req: Omit<LlmRequest, "schema">,
  schema: S,
): Promise<{ value: z.infer<S>; model: string | null }> {
  const jsonSchema = jsonSchemaFor(schema);
  let prompt = req.prompt;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await adapter.run({ ...req, prompt, schema: jsonSchema });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.text);
    } catch {
      lastError = "The reply was not valid JSON.";
      prompt = `${req.prompt}\n\nYour last reply failed validation: ${lastError} Reply with JSON only.`;
      continue;
    }
    const checked = schema.safeParse(parsed);
    if (checked.success) return { value: checked.data, model: res.model };
    lastError = checked.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    prompt = `${req.prompt}\n\nYour last reply failed validation: ${lastError}. Fix it and reply again.`;
  }
  throw new LlmError(`${adapter.label} returned an answer that failed validation twice (${lastError}).`);
}

export interface LlmConfig {
  tool?: LlmTool;
  model?: string | null;
  command?: string | null;
  maxInputTokens?: number | null;
}

export function adapterFor(tool: LlmTool, config: LlmConfig = {}): LlmAdapter {
  const model = config.tool === tool ? (config.model ?? null) : null;
  if (tool === "claude") return claudeAdapter({ model });
  if (tool === "codex") return codexAdapter({ model });
  if (!config.command) throw new LlmError("No AI command is set. Run stash push --llm cmd to set one.");
  return commandAdapter({ command: config.command, model, maxInputTokens: config.maxInputTokens ?? null });
}

/** The agent Stash is running inside, if it can tell. */
export function runningInside(env: NodeJS.ProcessEnv = process.env): LlmTool | null {
  if (env.CLAUDECODE === "1") return "claude";
  if (env.CODEX_SANDBOX || env.CODEX_MANAGED_BY_NPM || env.CODEX_HOME_SESSION) return "codex";
  return null;
}
