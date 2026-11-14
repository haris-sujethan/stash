// Health check used by `stash status` and the seed (BUILD.md section 9).
import { collections, db, vectorIndexState, EMBED_MODEL, VECTOR_INDEX } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await (await db()).command({ ping: 1 });
    const c = await collections();
    const [index, workspaces, projects] = await Promise.all([
      vectorIndexState(),
      c.workspaces.countDocuments(),
      c.projects.countDocuments(),
    ]);
    return Response.json({
      api: "ok",
      db: "ok",
      index: index.exists ? index.status : "MISSING",
      indexQueryable: index.queryable,
      indexName: VECTOR_INDEX,
      embedModel: EMBED_MODEL,
      workspaces,
      projects,
    });
  } catch (err) {
    // Never echo the connection string; driver errors can include the host.
    const message = err instanceof Error ? err.name : "Error";
    return Response.json({ api: "ok", db: "error", error: message }, { status: 503 });
  }
}
