// Server-side reads for the app pages. The website has no login in the MVP (one seeded Workspace, MVP.md);
// approvals are protected by the approver secret, not by the page.
import { collections } from "./db";

export async function projectsWithActivity() {
  const c = await collections();
  const projects = await c.projects.find({}).toArray();
  const latest = await c.sessions
    .aggregate<{ _id: string; at: Date; n: number }>([{ $group: { _id: "$projectId", at: { $max: "$updatedAt" }, n: { $sum: 1 } } }])
    .toArray();
  const by = new Map(latest.map((l) => [l._id, l]));
  return projects
    .map((p) => ({ ...p, lastActivity: by.get(p._id)?.at ?? p.createdAt, sessions: by.get(p._id)?.n ?? 0 }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/** The project named in ?project=, else the most recently active one. */
export async function currentProject(projectParam: string | undefined) {
  const projects = await projectsWithActivity();
  const project = projects.find((p) => p._id === projectParam) ?? projects[0] ?? null;
  return { project, projects };
}

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function ago(d: Date | string): string {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const TYPE_LABEL: Record<string, string> = {
  decision: "Decision",
  discovery: "Discovery",
  failed_approach: "Failed approach",
  constraint: "Constraint",
  open_question: "Open question",
};

export const KIND_LABEL: Record<string, string> = {
  conflicting: "Conflicting",
  duplicate: "Duplicate",
  complementary: "Complementary",
  only_in_one: "Only in one source",
};
