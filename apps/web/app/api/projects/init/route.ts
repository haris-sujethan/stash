// POST /api/projects/init: create or join the Project for a repository, matched by its normalized remote.
import { InitProjectRequest, type InitProjectResponse } from "@stash/context-format";
import { newId, normalizeRemote } from "@stash/core";
import { collections } from "@/lib/db";
import { audit, authenticate, body, HttpError, route } from "@/lib/http";

export const POST = route(async (req) => {
  const caller = await authenticate(req);
  const input = await body(req, InitProjectRequest);
  const remote = input.remote ? normalizeRemote(input.remote) : null;
  if (!remote && !input.name) throw new HttpError(400, "This repository has no git remote. Pass a project name.");
  const c = await collections();

  const filter = remote ? { workspaceId: caller.workspaceId, remote } : { workspaceId: caller.workspaceId, remote: null, name: input.name! };
  const existing = await c.projects.findOne(filter);
  if (existing) {
    const res: InitProjectResponse = { projectId: existing._id, workspaceId: existing.workspaceId, name: existing.name, remote: existing.remote, created: false };
    return Response.json(res);
  }
  const name = input.name ?? remote!.split("/").at(-1)!;
  const project = { _id: newId("project"), workspaceId: caller.workspaceId, name, remote, createdAt: new Date() };
  try {
    await c.projects.insertOne(project);
  } catch (err) {
    // Two laptops initialising at once: the unique index makes the second one join.
    const raced = await c.projects.findOne(filter);
    if (!raced) throw err;
    return Response.json({ projectId: raced._id, workspaceId: raced.workspaceId, name: raced.name, remote: raced.remote, created: false });
  }
  await audit(caller, "project.create", project._id);
  const res: InitProjectResponse = { projectId: project._id, workspaceId: caller.workspaceId, name, remote, created: true };
  return Response.json(res, { status: 201 });
});
