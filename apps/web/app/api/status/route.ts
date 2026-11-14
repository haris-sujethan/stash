// Health check. M1 adds the database, index and Workspace checks (BUILD.md section 9).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ api: "ok", db: "not configured until M1" });
}
