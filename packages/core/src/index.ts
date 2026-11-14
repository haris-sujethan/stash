// Small, pure helpers shared by the CLI and the web app.
import { createHash, randomBytes } from "node:crypto";

export const ID_PREFIXES = {
  workspace: "wsp_",
  project: "prj_",
  session: "ses_",
  memory: "mem_",
  merge: "m_",
  guardrail: "g_",
  pull: "p_",
} as const;
export type IdKind = keyof typeof ID_PREFIXES;

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";

/** A short prefixed id: prefix + 8 random base36 chars, e.g. `ses_k3m9x2pq`. */
export function newId(kind: IdKind, length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += BASE36[b % 36];
  return ID_PREFIXES[kind] + out;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Stable Event id, so re-uploading the same Event never duplicates it. */
export function eventId(nativeSessionId: string, recordUuid: string, blockIndex: number): string {
  return sha256(`${nativeSessionId}:${recordUuid}:${blockIndex}`).slice(0, 24);
}

/** Hash of the ordered Event ids: equal hashes mean nothing changed since the last push. */
export function contentHash(orderedEventIds: readonly string[]): string {
  return sha256(orderedEventIds.join("\n"));
}

/** Deterministic token estimate used for budgets: ceil(chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The line every Briefing starts with; finding it in a later Transcript records lineage. */
export const BRIEFING_MARKER = /stash:briefing ((?:ses|m)_[a-z0-9]+)@v(\d+) pull=(p_[a-z0-9]+)/g;

export interface MarkerMatch {
  sourceId: string;
  sourceType: "session" | "merge";
  sourceVersion: number;
  pullId: string;
}

export function briefingMarker(sourceId: string, version: number, pullId: string): string {
  return `stash:briefing ${sourceId}@v${version} pull=${pullId}`;
}

export function findBriefingMarkers(text: string): MarkerMatch[] {
  const seen = new Set<string>();
  const out: MarkerMatch[] = [];
  for (const m of text.matchAll(BRIEFING_MARKER)) {
    const [, sourceId, version, pullId] = m;
    if (!sourceId || !version || !pullId || seen.has(pullId)) continue;
    seen.add(pullId);
    out.push({
      sourceId,
      sourceType: sourceId.startsWith("m_") ? "merge" : "session",
      sourceVersion: Number(version),
      pullId,
    });
  }
  return out;
}

/** Every prompt Stash sends to an AI tool starts with this, so push never captures Stash's own calls. */
export const EXTRACT_MARKER = "stash:extract";

/**
 * Normalizes a git remote so every clone of a repository maps to one Project:
 * strips the protocol, credentials, `git@` and `.git`, and lowercases it.
 * `git@github.com:Owner/Repo.git` and `https://github.com/owner/repo` both become `github.com/owner/repo`.
 */
export function normalizeRemote(remote: string): string | null {
  let r = remote.trim();
  if (!r) return null;
  r = r.replace(/^[a-z+]+:\/\//i, ""); // https://, ssh://, git+ssh://
  r = r.replace(/^[^@/]+@/, ""); // user@ or user:token@
  r = r.replace(/^([^/:]+):(?!\d+\/)/, "$1/"); // scp-like host:path → host/path
  r = r.replace(/^([^/:]+):\d+\//, "$1/"); // drop ports
  r = r.replace(/\.git$/i, "").replace(/\/+$/, "");
  return r.toLowerCase() || null;
}
