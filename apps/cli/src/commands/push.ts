// stash push (BUILD.md section 11): find the session, capture it, redact locally, upload, record a Version.
import { hostname } from "node:os";
import { MAX_BATCH_BYTES, MAX_BATCH_EVENTS, type UploadEvent } from "@stash/context-format";
import { contentHash } from "@stash/core";
import { claudeCode } from "@stash/agent-adapters";
import { git, repoRoot, requireRepoConfig, requireUserConfig, UserError } from "../config.js";
import { batches, StashApi } from "../api.js";
import { discoverSession } from "../discover.js";
import { loadEnvValues, Redactor } from "../redact.js";
import { ask, canPrompt } from "../prompt.js";
import { ago, ok, shortId } from "../ui.js";

export async function push(opts: { session?: string; llm?: string }) {
  const user = await requireUserConfig();
  const root = repoRoot();
  const repo = await requireRepoConfig(root);
  const api = StashApi.from(user);

  // 1. Find the session.
  const found = await discoverSession({ flag: opts.session, env: process.env.CLAUDE_CODE_SESSION_ID, dirs: [process.cwd(), root] });
  let candidate;
  if (found.kind === "found") {
    candidate = found.candidate;
  } else {
    const list = found.candidates.slice(0, 9);
    if (!canPrompt()) {
      throw new UserError(
        "More than one Claude Code session for this folder. Pick one with --session <id>:\n" +
          list.map((c) => `  ${c.nativeSessionId}  ${ago(c.modifiedAt).padEnd(8)}  ${c.title}`).join("\n"),
      );
    }
    console.log("More than one Claude Code session for this folder:");
    list.forEach((c, i) => console.log(`  ${i + 1}. ${c.title}  (${ago(c.modifiedAt)})`));
    const pick = Number(await ask(`Which one? [1-${list.length}] `));
    candidate = list[pick - 1];
    if (!candidate) throw new UserError("No session chosen. Nothing was pushed.");
  }

  // 2–3. Capture and normalize.
  const captured = await claudeCode.capture(candidate.path);
  ok("Capturing session", `claude-code ${shortId(captured.nativeSessionId)}  ${captured.events.length} events  "${captured.title}"`);

  // 4. Redact before anything leaves the machine. If scanning fails, upload nothing.
  let events: UploadEvent[];
  let redactedCount: number;
  try {
    const redactor = new Redactor(await loadEnvValues(root));
    events = redactor.redact(captured.events) as UploadEvent[];
    redactedCount = redactor.report().distinct;
  } catch (err) {
    throw new UserError(`Secret scanning failed, so nothing was uploaded. (${err instanceof Error ? err.message : String(err)})`);
  }
  ok("Scanning for secrets", `${redactedCount} redacted`);

  // 5. Upload only what the server doesn't have.
  const session = await api.resolveSession({
    projectId: repo.projectId,
    agent: "claude-code",
    nativeSessionId: captured.nativeSessionId,
    title: captured.title,
    machine: hostname(),
    gitBranch: captured.gitBranch ?? git(["rev-parse", "--abbrev-ref", "HEAD"], root),
    gitCommit: git(["rev-parse", "HEAD"], root),
  });
  const known = new Set(session.knownEventIds);
  const fresh = events.filter((e) => !known.has(e._id));
  let inserted = 0;
  for (const batch of batches(fresh, MAX_BATCH_EVENTS, MAX_BATCH_BYTES)) {
    inserted += (await api.uploadEvents(session.sessionId, batch)).inserted;
  }
  ok("Uploading transcript", `${events.length} events (${inserted} new)`);

  // 6. Record a Version, or stop when nothing changed.
  const version = await api.createVersion(session.sessionId, {
    contentHash: contentHash(events.map((e) => e._id)),
    eventCount: events.length,
    redactedCount,
  });
  if (version.unchanged) {
    console.log(`\nNo changes detected. Already up to date (v${version.version}).`);
    return;
  }
  ok("Recorded version", `v${version.version}`);
  console.log(`\nPush complete.  Session ${session.sessionId}  Version ${version.version}`);
  console.log("(Digest and Memories come in M5, through your own AI tool.)");
  void opts.llm;
}
