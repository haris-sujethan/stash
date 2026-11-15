// Session Lineage: every Briefing starts with
// `stash:briefing <source>@v<n> pull=<p_id>`. When that line shows up in a pushed Transcript (the agent ran
// stash pull, or a human pasted the Briefing), the Session records the source as a parent. Several markers mean
// several parents. Only pulls that really happened in this Project count, so a made-up marker records nothing.
import type { LineageEntry } from "@stash/context-format";
import { findBriefingMarkers } from "@stash/core";
import { collections } from "./db";

export async function recordLineage(sessionId: string, projectId: string): Promise<LineageEntry[]> {
  const c = await collections();
  const marked = await c.events
    .find(
      {
        sessionId,
        type: { $in: ["tool_result", "user_message"] },
        $or: [{ "output.excerpt": { $regex: "stash:briefing " } }, { text: { $regex: "stash:briefing " } }],
      },
      { projection: { output: 1, text: 1 } },
    )
    .toArray();
  const found = findBriefingMarkers(marked.map((e) => `${e.output?.excerpt ?? ""}\n${e.text ?? ""}`).join("\n"));
  if (found.length === 0) return (await c.sessions.findOne({ _id: sessionId }, { projection: { lineage: 1 } }))?.lineage ?? [];

  const pulls = await c.pulls.find({ _id: { $in: found.map((f) => f.pullId) }, projectId }).toArray();
  const real = new Map(pulls.map((p) => [p._id, p]));
  const entries: LineageEntry[] = found
    .filter((f) => real.get(f.pullId)?.sourceId === f.sourceId && f.sourceId !== sessionId)
    .map((f) => ({ sourceId: f.sourceId, sourceType: f.sourceType, sourceVersion: real.get(f.pullId)!.sourceVersion, pullId: f.pullId }));

  const session = await c.sessions.findOne({ _id: sessionId }, { projection: { lineage: 1 } });
  const known = new Set((session?.lineage ?? []).map((l) => l.pullId));
  const fresh = entries.filter((e) => !known.has(e.pullId));
  if (fresh.length) await c.sessions.updateOne({ _id: sessionId }, { $push: { lineage: { $each: fresh } } });
  return [...(session?.lineage ?? []), ...fresh];
}
