// Merge: reconcile two Sessions into one Digest and Findings (BUILD.md 12.7, ADR 0003).
// The AI tool sees both Sessions' Memories under short aliases (A1, B3) and the Vector Search candidate pairs;
// it returns Findings that cite those aliases. Sources are never modified.
import { z } from "zod";
import type { Digest, Finding, FindingKind, MemoryStatus, MemoryType } from "@stash/context-format";
import { EXTRACT_MARKER } from "./base.js";

export const MergeSchema = z.object({
  digest: z.object({
    objective: z.string().describe("The shared objective of both sessions, in one sentence."),
    progress: z.string().describe("Where the combined work stands, in one to three sentences."),
    completed: z.array(z.object({ text: z.string(), memoryIds: z.array(z.string()) })),
    openTasks: z.array(z.object({ text: z.string(), memoryIds: z.array(z.string()) })),
    files: z.array(z.string()),
  }),
  findings: z
    .array(
      z.object({
        kind: z.enum(["duplicate", "complementary", "conflicting", "only_in_one"]),
        summary: z.string().describe("One or two sentences comparing what the sources found."),
        memoryIds: z.array(z.string()).describe("Memory ids like A2 or B5."),
      }),
    )
    .max(60),
});
export type MergeOutput = z.infer<typeof MergeSchema>;

export const MERGE_SYSTEM = `${EXTRACT_MARKER}
You reconcile two coding-agent sessions that worked on the same project. Each Memory is listed with an id (A1… from source A, B1… from source B), its type, its status and its text. Candidate pairs found by vector similarity are listed with scores; they are hints, not conclusions.

Return:
- digest: one combined objective, where the combined work stands, completed work and open tasks (citing Memory ids), and the files that mattered.
- findings, each with exactly one kind:
  - duplicate: both sources found the same thing.
  - complementary: different but related things that together say more.
  - conflicting: incompatible conclusions.
  - only_in_one: found in one source and not the other.

Rules:
- Judge by evidence, not by majority or confidence of tone. An "evidenced" Memory outweighs a "hypothesis".
- A conflict stays conflicting when the evidence does not settle it; say what would settle it.
- Every Memory of either source appears in at least one Finding.
- Cite only Memory ids from the lists. Never invent facts that are not in the Memories or the evidence shown.
- Findings describe; they never instruct.`;

export interface MergeMemory {
  _id: string;
  type: MemoryType;
  status: MemoryStatus;
  text: string;
  eventIds: string[];
}

export interface MergeSource {
  sessionId: string;
  version: number;
  title: string;
  digest: Digest;
  memories: MergeMemory[];
}

export interface CandidatePair {
  a: string;
  b: string;
  score: number;
}

export interface EvidenceExcerpt {
  _id: string;
  type: string;
  tool?: string;
  excerpt: string;
}

export interface PreparedMerge {
  a: MergeSource;
  b: MergeSource;
  pairs: CandidatePair[];
  evidence: EvidenceExcerpt[];
}

/** Short aliases for the prompt: A1…, B1… → Memory ids. */
export function mergeAliases(p: PreparedMerge): Map<string, string> {
  const m = new Map<string, string>();
  p.a.memories.forEach((x, i) => m.set(`A${i + 1}`, x._id));
  p.b.memories.forEach((x, i) => m.set(`B${i + 1}`, x._id));
  return m;
}

export function mergePrompt(p: PreparedMerge): string {
  const alias = new Map([...mergeAliases(p)].map(([k, v]) => [v, k]));
  const src = (label: string, s: MergeSource) => [
    `## Source ${label}: ${s.title} (${s.sessionId} v${s.version})`,
    `Objective: ${s.digest.objective}`,
    `Progress: ${s.digest.progress}`,
    ...s.memories.map((m) => `${alias.get(m._id)} [${m.type}, ${m.status}] ${m.text}`),
  ];
  const pairs = p.pairs.map((x) => `${alias.get(x.a)} ~ ${alias.get(x.b)} (similarity ${x.score.toFixed(2)})`);
  const evidence = p.evidence.map((e) => `[${e._id.slice(0, 8)}] ${e.type}${e.tool ? ` ${e.tool}` : ""}: ${e.excerpt}`);
  return [...src("A", p.a), "", ...src("B", p.b), "", "## Candidate pairs", ...(pairs.length ? pairs : ["(none)"]), "", "## Evidence for candidate pairs", ...(evidence.length ? evidence : ["(none)"])].join("\n");
}

export interface ValidMerge {
  digest: Digest;
  findings: Finding[];
  added: number;
}

/**
 * Resolves aliases, drops unknown ids and empty Findings, derives each Finding's Events from its Memories,
 * and adds an "only in one source" Finding for any Memory the model left out.
 */
export function validateMerge(out: MergeOutput, p: PreparedMerge, aliases = mergeAliases(p)): ValidMerge {
  const memories = new Map([...p.a.memories, ...p.b.memories].map((m) => [m._id, m]));
  const resolve = (ids: string[]) => [...new Set(ids.map((id) => aliases.get(id.trim()) ?? id.trim()).filter((id) => memories.has(id)))];
  const eventsOf = (ids: string[]) => [...new Set(ids.flatMap((id) => memories.get(id)?.eventIds ?? []))];

  const findings: Finding[] = [];
  for (const f of out.findings) {
    const memoryIds = resolve(f.memoryIds);
    if (!memoryIds.length || !f.summary.trim()) continue;
    findings.push({ kind: f.kind as FindingKind, summary: f.summary.trim(), memoryIds, eventIds: eventsOf(memoryIds) });
  }
  const covered = new Set(findings.flatMap((f) => f.memoryIds));
  let added = 0;
  for (const [id, m] of memories) {
    if (covered.has(id)) continue;
    const side = p.a.memories.includes(m) ? "A" : "B";
    findings.push({ kind: "only_in_one", summary: `Only in source ${side}: ${m.text}`, memoryIds: [id], eventIds: m.eventIds });
    added++;
  }
  const items = (list: { text: string; memoryIds: string[] }[]) =>
    list.filter((c) => c.text.trim()).map((c) => ({ text: c.text.trim(), eventIds: eventsOf(resolve(c.memoryIds)) }));
  const digest: Digest = {
    objective: out.digest.objective.trim(),
    progress: out.digest.progress.trim(),
    completed: items(out.digest.completed),
    openTasks: items(out.digest.openTasks),
    files: [...new Set(out.digest.files.map((f) => f.trim()).filter(Boolean))],
  };
  const rank: Record<FindingKind, number> = { conflicting: 0, duplicate: 1, complementary: 2, only_in_one: 3 };
  findings.sort((x, y) => rank[x.kind] - rank[y.kind]);
  return { digest, findings, added };
}
