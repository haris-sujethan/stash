// Request helpers for route handlers: bearer auth, body validation and consistent errors.
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { collections } from "./db";
import { hashToken } from "./secrets";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export interface Caller {
  workspaceId: string;
  tokenId: string;
}

/** Resolves the Workspace from `Authorization: Bearer <stash token>`. */
export async function authenticate(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Missing Stash token. Run `stash login`.");
  const c = await collections();
  const found = await c.apiTokens.findOne({ tokenHash: hashToken(token) });
  if (!found) throw new HttpError(401, "Invalid Stash token. Run `stash login` with a token from the seed.");
  return { workspaceId: found.workspaceId, tokenId: found._id };
}

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "Invalid request body.", parsed.error.issues.slice(0, 5));
  return parsed.data;
}

export async function audit(caller: Caller, action: string, target: string, actor: "token" | "approver" = "token") {
  const c = await collections();
  await c.auditLogs.insertOne({ _id: `log_${randomBytes(8).toString("hex")}`, workspaceId: caller.workspaceId, actor, action, target, at: new Date() });
}

/** Wraps a handler so thrown HttpErrors become JSON responses and nothing else leaks. */
export function route<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    try {
      return await fn(req, ...rest);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message, details: err.details }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

/** Next.js 16 passes dynamic route params as a promise. */
export type Params<K extends string> = { params: Promise<Record<K, string>> };

export async function projectFor(caller: Caller, projectId: string) {
  const c = await collections();
  const project = await c.projects.findOne({ _id: projectId, workspaceId: caller.workspaceId });
  if (!project) throw new HttpError(404, `Project ${projectId} not found in your Workspace. Run \`stash init\`.`);
  return project;
}

export async function sessionFor(caller: Caller, sessionId: string) {
  const c = await collections();
  const session = await c.sessions.findOne({ _id: sessionId, workspaceId: caller.workspaceId });
  if (!session) throw new HttpError(404, `Session ${sessionId} not found.`);
  return session;
}
