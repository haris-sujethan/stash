// Running the developer's own AI tool for every reasoning step (ADR 0005).
// The claude, codex and cmd adapters (BUILD.md 12.1) land in M5.

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
  maxInputTokens: number;
  detect(): Promise<boolean>;
  run(req: LlmRequest): Promise<LlmResult>;
}

export const DEFAULT_TIMEOUT_MS = 300_000;
