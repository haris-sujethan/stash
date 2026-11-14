// Request and response shapes shared by the CLI and the web API (BUILD.md section 9).
import { z } from "zod";
import { Event } from "./model.js";

export const InitProjectRequest = z.object({ remote: z.string().nullable().optional(), name: z.string().min(1).max(120).optional() });
export interface InitProjectResponse { projectId: string; workspaceId: string; name: string; remote: string | null; created: boolean }

export const ResolveSessionRequest = z.object({
  projectId: z.string(),
  agent: z.literal("claude-code"),
  nativeSessionId: z.string().min(1),
  title: z.string().max(200),
  machine: z.string().max(200),
  gitBranch: z.string().nullable(),
  gitCommit: z.string().nullable(),
});
export interface ResolveSessionResponse { sessionId: string; latestVersion: number; knownEventIds: string[] }

/** An Event as uploaded: the server fills in sessionId and projectId. */
export const UploadEvent = Event.omit({ sessionId: true, projectId: true });
export type UploadEvent = z.infer<typeof UploadEvent>;

export const MAX_BATCH_EVENTS = 500;
export const MAX_BATCH_BYTES = 2 * 1024 * 1024;
export const UploadEventsRequest = z.object({ events: z.array(UploadEvent).max(MAX_BATCH_EVENTS) });
export interface UploadEventsResponse { inserted: number; duplicates: number }

export const CreateVersionRequest = z.object({
  contentHash: z.string().length(64),
  eventCount: z.number().int().nonnegative(),
  redactedCount: z.number().int().nonnegative(),
});
export type CreateVersionResponse =
  | { unchanged: true; version: number; status: string }
  | { unchanged: false; version: number; status: string };

export interface SessionSummary {
  _id: string;
  title: string;
  agent: string;
  machine: string;
  latestVersion: number;
  versions: number;
  eventCount: number;
  memoryCount: number;
  updatedAt: string;
}

export interface StatusResponse {
  api: "ok";
  db: "ok" | "error";
  index?: string;
  indexQueryable?: boolean;
  auth?: "ok" | "invalid" | "none";
  workspaceId?: string;
  error?: string;
}

export interface SubmitExtractionResponse { version: number; memories: number; dropped: number; downgraded: number }
