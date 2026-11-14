import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { claudeAdapter, commandAdapter, firstJsonObject, runStructured, splitCommand } from "./index.js";

const Schema = z.object({ objective: z.string() });
let dir: string;

/** Writes an executable node script that acts as a fake AI tool. */
async function fakeTool(name: string, body: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `#!/usr/bin/env node\nlet input="";process.stdin.on("data",d=>input+=d);process.stdin.on("end",()=>{${body}});\n`);
  await chmod(path, 0o755);
  return path;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "stash-llm-"));
});

describe("command adapter", () => {
  it("sends the prompt on stdin and finds the JSON in chatty output", async () => {
    const tool = await fakeTool("chatty", `const ok=input.includes("the transcript");console.log("Sure! Here you go:\\n"+JSON.stringify({objective: ok?"fix logouts":"no prompt"})+"\\nHope that helps.")`);
    const res = await runStructured(commandAdapter({ command: tool }), { system: "sys", prompt: "the transcript", timeoutMs: 10_000 }, Schema);
    expect(res.value).toEqual({ objective: "fix logouts" });
  });

  it("retries once with the validation error, then succeeds", async () => {
    const tool = await fakeTool("second-try", `console.log(input.includes("failed validation") ? '{"objective":"ok"}' : '{"wrong":1}')`);
    const res = await runStructured(commandAdapter({ command: tool }), { system: "s", prompt: "p", timeoutMs: 10_000 }, Schema);
    expect(res.value.objective).toBe("ok");
  });

  it("gives up after two bad answers", async () => {
    const tool = await fakeTool("always-wrong", `console.log('{"wrong":1}')`);
    await expect(runStructured(commandAdapter({ command: tool }), { system: "s", prompt: "p", timeoutMs: 10_000 }, Schema)).rejects.toThrow(/failed validation twice/);
  });
});

describe("claude adapter", () => {
  it("reads structured_output and the model from Claude Code's JSON envelope", async () => {
    const tool = await fakeTool("claude", `const a=process.argv;const ok=a.includes("--no-session-persistence")&&a.includes("--json-schema")&&a[a.indexOf("--tools")+1]==="";console.log(JSON.stringify({type:"result",is_error:false,structured_output:{objective: ok?"flags ok":"flags missing"},modelUsage:{"claude-sonnet-5-5":{}}}))`);
    const res = await runStructured(claudeAdapter({ command: tool }), { system: "s", prompt: "p", timeoutMs: 10_000 }, Schema);
    expect(res).toEqual({ value: { objective: "flags ok" }, model: "claude-sonnet-5-5" });
  });

  it("surfaces Claude Code errors", async () => {
    const tool = await fakeTool("claude-err", `console.log(JSON.stringify({is_error:true,result:"Not logged in"}))`);
    await expect(claudeAdapter({ command: tool }).run({ system: "s", prompt: "p", schema: {}, timeoutMs: 10_000 })).rejects.toThrow(/Not logged in/);
  });
});

describe("helpers", () => {
  it("splits commands without a shell", () => {
    expect(splitCommand(`ollama run "qwen3:8b" --x 'a b'`)).toEqual(["ollama", "run", "qwen3:8b", "--x", "a b"]);
  });
  it("finds the first balanced JSON object", () => {
    expect(firstJsonObject(`noise {"a":{"b":"}"}} more {"c":1}`)).toBe(`{"a":{"b":"}"}}`);
    expect(firstJsonObject("none")).toBeNull();
  });
});

import { findExecutable } from "./index.js";

describe("findExecutable", () => {
  it("finds a tool in an install folder that isn't on PATH", async () => {
    const tool = await fakeTool("my-ai", "console.log('{}')");
    const prev = process.env.PATH;
    process.env.PATH = "/usr/bin:/bin";
    try {
      expect(findExecutable("my-ai")).toBeNull();
      expect(findExecutable("my-ai", [dir])).toBe(tool);
    } finally {
      process.env.PATH = prev;
    }
  });
});
