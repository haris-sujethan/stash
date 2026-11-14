// Seed: collections, indexes, the Vector Search index, the Workspace, the approver secret and a Stash token.
// Run from the repo root:  npm run seed            (full seed; asks for the approver secret)
//                          npm run seed -- --schema-only   (indexes only; no secrets)
//                          npm run seed -- --reset-approver (choose a new approver secret)
// Safe to run again: nothing is duplicated. Each full run prints one new token (e.g. one per laptop).
import { hostname } from "node:os";
import { ensureSchema, collections, mongoClient, vectorIndexState, VECTOR_INDEX } from "../lib/db";
import { hashApproverSecret, hashToken, newStashToken } from "../lib/secrets";

const WORKSPACE_ID = "wsp_demo1";
const args = new Set(process.argv.slice(2));

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) return reject(new Error("Run the seed in a terminal so the approver secret can be typed."));
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      } else if (ch === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function askApproverSecret(): Promise<string> {
  console.log("\nChoose the approver secret. Only a human who knows it can approve Guardrails.");
  console.log("Keep it in your head or a password manager. Never put it in a .env file (agents read those).");
  for (;;) {
    const a = await promptHidden("Approver secret (12+ characters): ");
    if (a.length < 12) {
      console.log("Too short. Use at least 12 characters.");
      continue;
    }
    const b = await promptHidden("Type it again: ");
    if (a === b) return a;
    console.log("They didn't match. Try again.");
  }
}

async function waitForIndex(): Promise<void> {
  const started = Date.now();
  for (;;) {
    const s = await vectorIndexState();
    if (s.queryable && s.status === "READY") {
      console.log(`✓ Vector Search index ${VECTOR_INDEX} is READY`);
      return;
    }
    if (Date.now() - started > 5 * 60_000) {
      console.log(`! Index is still ${s.status ?? "missing"} after 5 minutes. Check Atlas → Search & Vector Search.`);
      console.log("  If it says embedding is paused, turn on storage auto-scaling for Cluster0.");
      return;
    }
    process.stdout.write(`  waiting for the index (${s.status ?? "creating"})…\r`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function main() {
  console.log("Seeding Stash on", process.env.MONGODB_DB ?? "stash");
  await ensureSchema((line) => console.log("✓", line));
  await waitForIndex();
  if (args.has("--schema-only")) return;

  const c = await collections();
  const existing = await c.workspaces.findOne({ _id: WORKSPACE_ID });
  if (!existing || args.has("--reset-approver")) {
    const secret = await askApproverSecret();
    await c.workspaces.updateOne(
      { _id: WORKSPACE_ID },
      { $set: { approverHash: hashApproverSecret(secret) }, $setOnInsert: { name: "Demo", createdAt: new Date() } },
      { upsert: true },
    );
    console.log(existing ? "✓ Approver secret changed" : "✓ Workspace created");
  } else {
    console.log("✓ Workspace exists (approver secret unchanged; use --reset-approver to change it)");
  }

  const token = newStashToken();
  const label = `${hostname()} ${new Date().toISOString().slice(0, 16)}`;
  await c.apiTokens.insertOne({
    _id: `tok_${hashToken(token).slice(0, 12)}`,
    workspaceId: WORKSPACE_ID,
    tokenHash: hashToken(token),
    label,
    createdAt: new Date(),
  });
  console.log("\nYour Stash token (shown once; it is stored only as a hash):\n");
  console.log(`  ${token}\n`);
  console.log("Use it with: stash login --token <token>");
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await mongoClient().catch(() => null))?.close();
  });
