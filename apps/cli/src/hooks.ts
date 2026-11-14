// Claude Code hook configuration for Stash (pure functions, so they're easy to test).
// After every agent turn (Stop): upload that turn's Events in the background, no AI call.
// When the session ends (SessionEnd): a full push in the background (Digest, Memories, Guardrails, lineage).
export const STASH_HOOKS = {
  Stop: "stash push --hook --events-only",
  SessionEnd: "stash push --hook",
} as const;

type HookEntry = { matcher?: string; hooks: { type: string; command: string; timeout?: number }[] };
export type Settings = { hooks?: Record<string, HookEntry[]> } & Record<string, unknown>;

const isStash = (cmd: string) => /^stash push --hook\b/.test(cmd.trim());

/** Adds Stash's hooks, keeping every other setting and hook. Running it twice changes nothing. */
export function installHooks(settings: Settings): Settings {
  const out: Settings = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  for (const [event, command] of Object.entries(STASH_HOOKS)) {
    const entries = (out.hooks![event] ?? []).map((e) => ({ ...e, hooks: e.hooks.filter((h) => !isStash(h.command)) })).filter((e) => e.hooks.length);
    entries.push({ hooks: [{ type: "command", command, timeout: 30 }] });
    out.hooks![event] = entries;
  }
  return out;
}

/** Removes only Stash's hooks. */
export function uninstallHooks(settings: Settings): Settings {
  if (!settings.hooks) return settings;
  const hooks: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(settings.hooks)) {
    const kept = entries.map((e) => ({ ...e, hooks: e.hooks.filter((h) => !isStash(h.command)) })).filter((e) => e.hooks.length);
    if (kept.length) hooks[event] = kept;
  }
  const { hooks: _drop, ...rest } = settings;
  void _drop;
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

export function hooksInstalled(settings: Settings): Record<keyof typeof STASH_HOOKS, boolean> {
  const has = (event: string) => (settings.hooks?.[event] ?? []).some((e) => e.hooks.some((h) => isStash(h.command)));
  return { Stop: has("Stop"), SessionEnd: has("SessionEnd") };
}
