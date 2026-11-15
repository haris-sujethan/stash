// Every $vectorSearch lives here. Queries are plain text: Atlas embeds them with the same
// model it uses for Memory text. Every query is filtered to one Project and to current Memories.
import type { Document } from "mongodb";
import type { Memory } from "@stash/context-format";
import { collections, VECTOR_INDEX } from "./db";

export interface VectorHit extends Pick<Memory, "_id" | "type" | "text" | "status" | "sessionId" | "eventIds"> {
  score: number;
}

export async function searchMemories(opts: {
  projectId: string;
  query: string;
  limit: number;
  numCandidates?: number;
  filter?: Document;
}): Promise<VectorHit[]> {
  if (!opts.query.trim()) return [];
  const c = await collections();
  return c.memories
    .aggregate<VectorHit>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          path: "text",
          query: opts.query,
          numCandidates: opts.numCandidates ?? Math.max(100, opts.limit * 15),
          limit: opts.limit,
          filter: { projectId: opts.projectId, current: true, ...opts.filter },
        },
      },
      { $project: { _id: 1, type: 1, text: 1, status: 1, sessionId: 1, eventIds: 1, score: { $meta: "vectorSearchScore" } } },
    ])
    .toArray();
}

/** Pull: the Memories from other Sessions nearest the pulled objective. */
export function relatedForPull(projectId: string, objective: string, excludeSessionIds: string[]) {
  return searchMemories({ projectId, query: objective, limit: 8, filter: { sessionId: { $nin: excludeSessionIds } } });
}
