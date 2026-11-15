// stash merge <a> <b>: the server prepares both Sessions and the Vector Search candidates,
// the developer's AI tool reconciles them locally, and the CLI uploads the Merge. Sources never change.
import { DEFAULT_TIMEOUT_MS, runStructured } from "@stash/llm-adapters";
import { MERGE_SYSTEM, MergeSchema, mergePrompt, validateMerge, type PreparedMerge } from "@stash/core";
import { requireUserConfig } from "../config.js";
import { StashApi } from "../api.js";
import { chooseAdapter } from "../reason.js";
import { ok } from "../ui.js";

export async function merge(a: string, b: string, opts: { llm?: string }) {
  const user = await requireUserConfig();
  const api = StashApi.from(user);

  const prepared = await api.prepareMerge(a, b);
  ok("Loading sources", `${a} v${prepared.a.version} (${prepared.a.memories.length} memories), ${b} v${prepared.b.version} (${prepared.b.memories.length})`);
  ok("Finding related memories", `${prepared.pairs.length} candidate pairs (Vector Search)`);

  const adapter = await chooseAdapter(user, opts.llm);
  const started = Date.now();
  if (process.stdout.isTTY) process.stdout.write(`… Reconciling                ${adapter.label}`);
  const { value, model } = await runStructured(
    adapter,
    { system: MERGE_SYSTEM, prompt: mergePrompt(prepared as PreparedMerge), timeoutMs: DEFAULT_TIMEOUT_MS },
    MergeSchema,
  );
  if (process.stdout.isTTY) process.stdout.write("\r\x1b[2K");
  const valid = validateMerge(value, prepared);
  ok("Reconciling", `${adapter.tool}${model ? ` (${model})` : ""}  ${Math.round((Date.now() - started) / 1000)}s`);

  const res = await api.storeMerge({
    sources: [
      { sessionId: prepared.a.sessionId, version: prepared.a.version },
      { sessionId: prepared.b.sessionId, version: prepared.b.version },
    ],
    digest: valid.digest,
    findings: valid.findings,
    extractedBy: { tool: adapter.tool, model },
  });
  const n = res.counts;
  ok("Findings", `${n.conflicting ?? 0} conflicting, ${n.duplicate ?? 0} duplicate, ${n.complementary ?? 0} complementary, ${n.only_in_one ?? 0} only in one`);
  console.log(`\nMerge complete.  ${res.mergeId}   Pull it with: stash pull ${res.mergeId}`);
}
