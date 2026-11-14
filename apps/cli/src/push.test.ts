import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { batches } from "./api.js";
import { discoverSession } from "./discover.js";

describe("batches", () => {
  it("caps the count and the bytes of each batch", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ i, pad: "x".repeat(100) }));
    expect(batches(items, 5, 1e6).map((b) => b.length)).toEqual([5, 5, 2]);
    expect(batches(items, 100, 350).every((b) => Buffer.byteLength(JSON.stringify(b)) <= 350)).toBe(true);
    expect(batches([], 5, 100)).toEqual([]);
  });
});

describe("discoverSession", () => {
  let home: string;
  const prev = process.env.CLAUDE_CONFIG_DIR;
  const line = (uuid: string, text: string) =>
    JSON.stringify({ type: "user", uuid, parentUuid: null, timestamp: new Date().toISOString(), message: { role: "user", content: text } });

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "stash-discover-"));
    process.env.CLAUDE_CONFIG_DIR = home;
    const dir = join(home, "projects", "-work-demo");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "aaa.jsonl"), line("1", "Fix the login bug"));
    await writeFile(join(dir, "bbb.jsonl"), line("2", "Look at the cache"));
    await writeFile(join(dir, "ccc.jsonl"), line("3", "stash:extract\nYou are given a transcript"));
  });
  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = prev;
  });

  it("uses the session Claude Code says it is running in", async () => {
    const d = await discoverSession({ env: "bbb", dirs: ["/work/demo"] });
    expect(d).toMatchObject({ kind: "found", how: "env", candidate: { nativeSessionId: "bbb" } });
  });

  it("asks when there is more than one, and never offers Stash's own sessions", async () => {
    const d = await discoverSession({ dirs: ["/work/demo"] });
    expect(d.kind).toBe("choose");
    if (d.kind === "choose") expect(d.candidates.map((c) => c.nativeSessionId).sort()).toEqual(["aaa", "bbb"]);
  });

  it("refuses an unknown --session id", async () => {
    await expect(discoverSession({ flag: "nope", dirs: [] })).rejects.toThrow(/No Claude Code session nope/);
  });
});
