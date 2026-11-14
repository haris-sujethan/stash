// GET /api/status: database, Vector Search index and (when a token is sent) whether it is valid.
import type { StatusResponse } from "@stash/context-format";
import { db, vectorIndexState } from "@/lib/db";
import { authenticate, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await (await db()).command({ ping: 1 });
    const index = await vectorIndexState();
    const res: StatusResponse = { api: "ok", db: "ok", index: index.exists ? (index.status ?? "UNKNOWN") : "MISSING", indexQueryable: index.queryable, auth: "none" };
    if (req.headers.get("authorization")) {
      try {
        res.workspaceId = (await authenticate(req)).workspaceId;
        res.auth = "ok";
      } catch (err) {
        if (!(err instanceof HttpError)) throw err;
        res.auth = "invalid";
      }
    }
    return Response.json(res);
  } catch (err) {
    // Never echo the connection string; driver errors can include the host.
    const res: StatusResponse = { api: "ok", db: "error", error: err instanceof Error ? err.name : "Error" };
    return Response.json(res, { status: 503 });
  }
}
