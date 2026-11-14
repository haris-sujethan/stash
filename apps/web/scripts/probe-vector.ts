// Inserts two throwaway Memories, waits for Atlas to embed them, runs one $vectorSearch, then deletes them.
import { collections, mongoClient, VECTOR_INDEX } from "../lib/db";

const projectId = "prj_probe000";
const c = await collections();
const now = new Date();
const base = { projectId, sessionId: "ses_probe000", version: 1, status: "evidenced" as const, eventIds: ["e"], current: true, createdAt: now };
await c.memories.insertMany([
  { _id: "mem_probe001", ...base, type: "failed_approach", text: "Raising the database timeout to 30 seconds did not stop the intermittent login failures." },
  { _id: "mem_probe002", ...base, type: "discovery", text: "The landing page uses the Geologica font." },
]);
try {
  for (const shape of ["string", "object"] as const) {
    const query = shape === "string" ? "why do users get logged out at random" : { text: "why do users get logged out at random" };
    let hits: unknown[] = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 90_000) {
      try {
        hits = await c.memories.aggregate([
          { $vectorSearch: { index: VECTOR_INDEX, path: "text", query, numCandidates: 50, limit: 2, filter: { projectId, current: true } } },
          { $project: { _id: 1, score: { $meta: "vectorSearchScore" } } },
        ]).toArray();
      } catch (e) {
        console.log(`query as ${shape}: error ${(e as Error).message.slice(0, 160)}`);
        break;
      }
      if (hits.length === 2) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    console.log(`query as ${shape}: ${JSON.stringify(hits)} after ${Math.round((Date.now() - t0) / 1000)}s`);
  }
} finally {
  await c.memories.deleteMany({ projectId });
  await (await mongoClient()).close();
}
