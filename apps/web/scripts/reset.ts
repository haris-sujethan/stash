// Reset one Project for a fresh demo run: deletes its Sessions, Versions, Events, Memories, Merges, Guardrails,
// pull records and activity. Keeps the Project itself (so .stash.json still works), the Workspace, the approver
// secret, tokens and indexes. Deletion is permanent, so it shows what it will delete and asks you to type the
// Project's name first.
//   npm run reset -- stash-demo            (asks to confirm)
//   npm run reset -- stash-demo --dry-run  (only shows the counts)
import { createInterface } from "node:readline/promises";
import { collections, mongoClient } from "../lib/db";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

async function main() {
  const c = await collections();
  const projects = await c.projects.find({}).toArray();
  const project = projects.find((p) => p.name === name || p._id === name);
  if (!project) {
    console.log(`Which Project? npm run reset -- <name>\nProjects: ${projects.map((p) => p.name).join(", ") || "none"}`);
    process.exitCode = 1;
    return;
  }
  const projectId = project._id;
  const sessionIds = (await c.sessions.find({ projectId }, { projection: { _id: 1 } }).toArray()).map((s) => s._id);
  const mergeIds = (await c.merges.find({ projectId }, { projection: { _id: 1 } }).toArray()).map((m) => m._id);
  const guardrailIds = (await c.guardrails.find({ projectId }, { projection: { _id: 1 } }).toArray()).map((g) => g._id);
  const ids = [...sessionIds, ...mergeIds, ...guardrailIds];
  const activity = ids.length ? { target: { $regex: new RegExp(`^(${ids.join("|")})\\b`) } } : { _id: "__none__" };

  const plan = [
    ["Sessions", c.sessions, { projectId }],
    ["Versions", c.sessionVersions, { projectId }],
    ["Events", c.events, { projectId }],
    ["Memories", c.memories, { projectId }],
    ["Merges", c.merges, { projectId }],
    ["Guardrails", c.guardrails, { projectId }],
    ["Pull records", c.pulls, { projectId }],
    ["Activity entries", c.auditLogs, activity],
  ] as const;

  console.log(`Project ${project.name} (${projectId}) contains:`);
  for (const [label, col, filter] of plan) console.log(`  ${String(await col.countDocuments(filter as never)).padStart(6)}  ${label}`);
  console.log("Kept: the Project, the Workspace, the approver secret, tokens, indexes, and every other Project.");
  if (dryRun) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const typed = (await rl.question(`\nThis permanently deletes the above. Type the Project name (${project.name}) to confirm: `)).trim();
  rl.close();
  if (typed !== project.name) {
    console.log("Not confirmed. Nothing was deleted.");
    return;
  }
  for (const [label, col, filter] of plan) {
    const r = await col.deleteMany(filter as never);
    console.log(`✓ deleted ${r.deletedCount} ${label}`);
  }
  console.log(`\n${project.name} is empty and ready for a new run.`);
}

main()
  .catch((err: unknown) => {
    console.error("Reset failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await mongoClient().catch(() => null))?.close();
  });
