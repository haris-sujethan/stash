// One MongoClient per process, typed collections, and every index Stash needs.
import { MongoClient, type Db, type IndexDescription } from "mongodb";
import type { Event, Memory, Merge, Guardrail, Pull, Session, SessionVersion } from "@stash/context-format";

export interface Workspace {
  _id: string;
  name: string;
  approverHash: string;
  createdAt: Date;
}

export interface Project {
  _id: string;
  workspaceId: string;
  name: string;
  remote: string | null;
  createdAt: Date;
}

export interface ApiToken {
  _id: string;
  workspaceId: string;
  tokenHash: string;
  label: string;
  createdAt: Date;
}

export interface AuditLog {
  _id: string;
  workspaceId: string;
  actor: "token" | "approver";
  action: string;
  target: string;
  at: Date;
}

export const VECTOR_INDEX = process.env.VECTOR_INDEX ?? "memories_vector";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "voyage-4";

const globalForMongo = globalThis as unknown as { __stashMongo?: Promise<MongoClient> };

export function mongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Put it in apps/web/.env.local.");
  globalForMongo.__stashMongo ??= new MongoClient(uri, { appName: "stash" }).connect();
  return globalForMongo.__stashMongo;
}

export async function db(): Promise<Db> {
  return (await mongoClient()).db(process.env.MONGODB_DB ?? "stash");
}

export async function collections() {
  const d = await db();
  return {
    workspaces: d.collection<Workspace>("workspaces"),
    apiTokens: d.collection<ApiToken>("api_tokens"),
    projects: d.collection<Project>("projects"),
    sessions: d.collection<Session>("sessions"),
    sessionVersions: d.collection<SessionVersion>("session_versions"),
    events: d.collection<Event>("events"),
    memories: d.collection<Memory>("memories"),
    merges: d.collection<Merge>("merges"),
    guardrails: d.collection<Guardrail>("guardrails"),
    pulls: d.collection<Pull>("pulls"),
    auditLogs: d.collection<AuditLog>("audit_logs"),
  };
}

export const COLLECTION_NAMES = [
  "workspaces",
  "api_tokens",
  "projects",
  "sessions",
  "session_versions",
  "events",
  "memories",
  "merges",
  "guardrails",
  "pulls",
  "audit_logs",
] as const;

/** Regular indexes, by collection. */
export const INDEXES: Record<string, IndexDescription[]> = {
  sessions: [
    { key: { projectId: 1, agent: 1, nativeSessionId: 1 }, unique: true, name: "session_identity" },
    { key: { projectId: 1, updatedAt: -1 }, name: "project_recent" },
  ],
  session_versions: [{ key: { sessionId: 1, version: -1 }, name: "session_versions" }],
  events: [{ key: { sessionId: 1, seq: 1 }, name: "session_order" }],
  memories: [
    { key: { sessionId: 1, current: 1 }, name: "session_current" },
    { key: { projectId: 1, current: 1, type: 1 }, name: "project_current_type" },
  ],
  merges: [{ key: { projectId: 1, createdAt: -1 }, name: "project_recent" }],
  guardrails: [{ key: { projectId: 1, status: 1 }, name: "project_status" }],
  projects: [
    {
      key: { workspaceId: 1, remote: 1 },
      unique: true,
      name: "workspace_remote",
      partialFilterExpression: { remote: { $type: "string" } },
    },
  ],
  api_tokens: [{ key: { tokenHash: 1 }, unique: true, name: "token_hash" }],
  audit_logs: [{ key: { workspaceId: 1, at: -1 }, name: "workspace_recent" }],
};

/** The one Vector Search index: Atlas embeds Memory text itself (Automated Embedding, no key). */
export function vectorIndexDefinition() {
  return {
    fields: [
      { type: "autoEmbed", modality: "text", path: "text", model: EMBED_MODEL },
      { type: "filter", path: "projectId" },
      { type: "filter", path: "sessionId" },
      { type: "filter", path: "type" },
      { type: "filter", path: "status" },
      { type: "filter", path: "current" },
    ],
  };
}

export interface VectorIndexState {
  exists: boolean;
  status: string | null;
  queryable: boolean;
}

export async function vectorIndexState(): Promise<VectorIndexState> {
  const d = await db();
  const found = await d.collection("memories").listSearchIndexes(VECTOR_INDEX).toArray();
  const idx = found[0] as { status?: string; queryable?: boolean } | undefined;
  if (!idx) return { exists: false, status: null, queryable: false };
  return { exists: true, status: String(idx.status ?? "UNKNOWN"), queryable: Boolean(idx.queryable) };
}

/** Creates collections, regular indexes and the Vector Search index. Safe to run repeatedly. */
export async function ensureSchema(log: (line: string) => void = () => {}): Promise<void> {
  const d = await db();
  const existing = new Set((await d.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of COLLECTION_NAMES) {
    if (!existing.has(name)) {
      await d.createCollection(name);
      log(`created collection ${name}`);
    }
  }
  for (const [name, specs] of Object.entries(INDEXES)) {
    await d.collection(name).createIndexes(specs);
  }
  log("regular indexes ready");

  const state = await vectorIndexState();
  if (!state.exists) {
    await d.collection("memories").createSearchIndex({
      name: VECTOR_INDEX,
      type: "vectorSearch",
      definition: vectorIndexDefinition(),
    });
    log(`requested Vector Search index ${VECTOR_INDEX} (${EMBED_MODEL})`);
  } else {
    log(`Vector Search index ${VECTOR_INDEX} exists (${state.status})`);
  }
}
