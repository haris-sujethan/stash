import { describe, expect, it } from "vitest";
import { hooksInstalled, installHooks, uninstallHooks, type Settings } from "./hooks.js";

const theirs: Settings = {
  permissions: { allow: ["Bash(npm test)"] },
  hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }], PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "audit.sh" }] }] },
};

describe("installHooks", () => {
  it("adds Stop and SessionEnd hooks and keeps everything else", () => {
    const s = installHooks(theirs);
    expect(s.permissions).toEqual(theirs.permissions);
    expect(s.hooks?.PreToolUse).toEqual(theirs.hooks?.PreToolUse);
    expect(s.hooks?.Stop?.map((e) => e.hooks[0]?.command)).toEqual(["say done", "stash push --hook --events-only"]);
    expect(s.hooks?.SessionEnd?.[0]?.hooks[0]?.command).toBe("stash push --hook");
    expect(hooksInstalled(s)).toEqual({ Stop: true, SessionEnd: true });
  });

  it("is idempotent", () => {
    expect(installHooks(installHooks(theirs))).toEqual(installHooks(theirs));
  });
});

describe("uninstallHooks", () => {
  it("removes only Stash's hooks", () => {
    expect(uninstallHooks(installHooks(theirs))).toEqual(theirs);
    expect(uninstallHooks(installHooks({}))).toEqual({});
  });
});
