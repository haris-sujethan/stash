// Adds a Proposed Guardrail for the stash-demo recording, built from what Stash actually learned in the Project:
// it finds the evidenced Memories about the database-timeout red herring and the refresh-token 401s, and cites them.
// Stash normally proposes a rule only when the same failure appears in two Sessions; this script stands in for that
// step when a demo run doesn't produce one. It is marked "demo seed" so it is never mistaken for an automatic one.
//   npm run demo-guardrail              (Project stash-demo)
//   npm run demo-guardrail -- <project>
import { newId } from "@stash/core";
import { collections, mongoClient } from "../lib/db";

const name = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "stash-demo";

const RULE = "For random-logout bugs, check the token refresh path first (concurrent requests reusing a single-use refresh token) before changing database timeouts.";
const PATTERN = "Chasing database timeouts for logouts that come from refresh-token reuse";

async function main() {
  const c = await collections();
  const project = await c.projects.findOne({ name });
  if (!project) throw new Error(`No Project called ${name}.`);
  if (await c.guardrails.findOne({ projectId: project._id, pattern: PATTERN })) {
    console.log("The demo Guardrail is already there. Open the app's Guardrails page.");
    return;
  }
  const memories = await c.memories
    .find({ projectId: project._id, current: true, status: { $in: ["evidenced", "verified"] } })
    .toArray();
  const pick = (re: RegExp) => memories.find((m) => re.test(m.text));
  const evidence = [pick(/database timeout|db timeout|ops suspects/i), pick(/concurrent/i) ?? pick(/refresh token|single-use|401/i)]
    .filter((m, i, all): m is NonNullable<typeof m> => Boolean(m) && all.findIndex((x) => x?._id === m!._id) === i);
  if (evidence.length === 0) {
    throw new Error("No evidenced Memories about the logout bug yet. Push a stash-demo session first.");
  }

  const guardrail = {
    _id: newId("guardrail"),
    projectId: project._id,
    rule: RULE,
    rationale:
      "Stash's Memories from this Project show the README's database-timeout theory did not hold: the failures were 401s from the access-token refresh path, including when two requests refresh at the same time.",
    status: "proposed" as const,
    evidence: evidence.map((m) => ({ sessionId: m.sessionId, memoryId: m._id, eventIds: m.eventIds })),
    pattern: PATTERN,
    extractedBy: { tool: "cmd" as const, model: "demo seed" },
    createdAt: new Date(),
  };
  await c.guardrails.insertOne(guardrail);
  await c.auditLogs.insertOne({ _id: `log_${guardrail._id}`, workspaceId: project.workspaceId, actor: "token", action: "guardrail.propose", target: guardrail._id, at: new Date() });
  console.log(`✓ Proposed Guardrail ${guardrail._id}`);
  console.log(`  ${RULE}`);
  console.log(`  Evidence: ${evidence.map((m) => m._id).join(", ")}`);
  console.log("Approve it on the app's Guardrails page with the approver secret.");
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await mongoClient().catch(() => null))?.close();
  });
