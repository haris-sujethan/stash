// Universal Context Format: the shapes every Transcript, Digest and Memory take,
// whichever agent produced them. Terms follow GLOSSARY.md; the data model is BUILD.md section 7.
import { z } from "zod";

export const EVENT_TYPES = [
  "user_message",
  "assistant_message",
  "tool_call",
  "tool_result",
  "file_read",
  "file_change",
  "error",
  "branch_abandoned",
] as const;
export const EventType = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventType>;

export const MEMORY_TYPES = ["decision", "discovery", "failed_approach", "constraint", "open_question"] as const;
export const MemoryType = z.enum(MEMORY_TYPES);
export type MemoryType = z.infer<typeof MemoryType>;

export const MemoryStatus = z.enum(["hypothesis", "evidenced", "verified"]);
export type MemoryStatus = z.infer<typeof MemoryStatus>;

export const FindingKind = z.enum(["duplicate", "complementary", "conflicting", "only_in_one"]);
export type FindingKind = z.infer<typeof FindingKind>;

export const LlmTool = z.enum(["claude", "codex", "cmd"]);
export type LlmTool = z.infer<typeof LlmTool>;

export const ExtractedBy = z.object({ tool: LlmTool, model: z.string().nullable() });
export type ExtractedBy = z.infer<typeof ExtractedBy>;

export const OutputExcerpt = z.object({
  excerpt: z.string(),
  truncated: z.boolean(),
  originalLength: z.number().int().nonnegative(),
  sha256: z.string(),
});
export type OutputExcerpt = z.infer<typeof OutputExcerpt>;

/** One thing that observably happened. Never edited, never an interpretation. */
export const Event = z.object({
  _id: z.string(), // sha256(nativeSessionId:uuid:blockIndex), 24 hex chars
  sessionId: z.string(),
  projectId: z.string(),
  seq: z.number().int().nonnegative(),
  type: EventType,
  ts: z.coerce.date(),
  text: z.string().optional(),
  tool: z
    .object({ name: z.string(), useId: z.string(), input: z.unknown().optional(), isError: z.boolean().optional() })
    .optional(),
  file: z.object({ path: z.string(), op: z.enum(["read", "write", "edit"]) }).optional(),
  output: OutputExcerpt.optional(),
  sidechain: z.boolean(),
});
export type Event = z.infer<typeof Event>;

const Cited = z.object({ text: z.string(), eventIds: z.array(z.string()) });

export const Digest = z.object({
  objective: z.string(),
  progress: z.string(),
  completed: z.array(Cited),
  openTasks: z.array(Cited),
  files: z.array(z.string()),
});
export type Digest = z.infer<typeof Digest>;

export const Memory = z.object({
  _id: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
  version: z.number().int().positive(),
  type: MemoryType,
  text: z.string(),
  status: MemoryStatus,
  eventIds: z.array(z.string()).min(1),
  current: z.boolean(),
  verifiedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
});
export type Memory = z.infer<typeof Memory>;

export const Finding = z.object({
  kind: FindingKind,
  summary: z.string(),
  memoryIds: z.array(z.string()),
  eventIds: z.array(z.string()),
});
export type Finding = z.infer<typeof Finding>;

export interface LineageEntry {
  sourceId: string;
  sourceType: "session" | "merge";
  sourceVersion: number;
  pullId: string;
}

export interface Session {
  _id: string;
  projectId: string;
  workspaceId: string;
  agent: "claude-code";
  nativeSessionId: string;
  title: string;
  latestVersion: number;
  eventCount: number;
  lineage: LineageEntry[];
  machine: string;
  gitBranch: string | null;
  gitCommit: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionVersion {
  _id: string; // `${sessionId}@v${n}`
  sessionId: string;
  projectId: string;
  version: number;
  eventCount: number;
  contentHash: string;
  status: "processing" | "processed" | "failed";
  digest: Digest | null;
  extractedBy: ExtractedBy | null;
  partial: boolean;
  redactedCount: number;
  createdAt: Date;
  processedAt: Date | null;
  error?: string;
}

export interface Merge {
  _id: string;
  projectId: string;
  sources: { sessionId: string; version: number }[];
  digest: Digest;
  findings: Finding[];
  extractedBy: ExtractedBy;
  createdAt: Date;
}

export interface Guardrail {
  _id: string;
  projectId: string;
  rule: string; // the only place an instruction is allowed
  rationale: string;
  status: "proposed" | "approved" | "rejected";
  evidence: { sessionId: string; memoryId: string; eventIds: string[] }[];
  pattern: string;
  extractedBy: ExtractedBy;
  createdAt: Date;
  decidedAt?: Date;
}

export interface Pull {
  _id: string;
  projectId: string;
  sourceId: string;
  sourceType: "session" | "merge";
  sourceVersion: number;
  budget: number;
  tokensUsed: number;
  relatedMemoryIds: string[];
  agentSessionHint: string | null;
  createdAt: Date;
}

