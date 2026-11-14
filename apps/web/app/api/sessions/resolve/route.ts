// POST /api/sessions/resolve: find or create the Session for a native agent session; return the Event ids already stored.
import { ResolveSessionRequest, type ResolveSessionResponse } from "@stash/context-format";
import { newId } from "@stash/core";
import { collections } from "@/lib/db";
import { audit, authenticate, body, projectFor, route } from "@/lib/http";

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const input = await body(req, ResolveSessionRequest);
  await projectFor(caller, input.projectId);
  const c = await collections();
  const now = new Date();

  const found = await c.sessions.findOneAndUpdate(
    { projectId: input.projectId, agent: input.agent, nativeSessionId: input.nativeSessionId },
    {
      $set: { title: input.title, machine: input.machine, gitBranch: input.gitBranch, gitCommit: input.gitCommit, updatedAt: now },
      $setOnInsert: {
        _id: newId("session"),
        projectId: input.projectId,
        workspaceId: caller.workspaceId,
        agent: input.agent,
        nativeSessionId: input.nativeSessionId,
        latestVersion: 0,
        eventCount: 0,
        lineage: [],
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  const session = found!;
  if (session.createdAt.getTime() === now.getTime()) await audit(caller, "session.create", session._id);

  const known = await c.events.find({ sessionId: session._id }, { projection: { _id: 1 } }).toArray();
  const res: ResolveSessionResponse = { sessionId: session._id, latestVersion: session.latestVersion, knownEventIds: known.map((e) => e._id) };
  return Response.json(res);
});
