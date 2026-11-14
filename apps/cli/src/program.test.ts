import { describe, expect, it } from "vitest";
import { buildProgram } from "./program.js";

describe("stash CLI", () => {
  it("exposes exactly the MVP commands, with no approve command", () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toEqual(["login", "init", "push", "pull", "merge", "sessions", "status", "hooks", "guardrails"]);
    expect(names.some((n) => /approve|reject|verify/.test(n))).toBe(false);
  });
});
