# Stash: Build Plan

This is the complete plan for building the Stash hackathon MVP. An agent with no other context should be able to read this file, then the documents it points to, and build the whole thing.

## 0. Before you start

### Read these, in this order

| File | What it is | Authority |
| --- | --- | --- |
| `BUILD.md` (this file) | How to build it: stack, data model, APIs, algorithms, milestones | How |
| `MVP.md` | What the 24-hour MVP is: every scoped decision | **Wins** on what to build |
| `GLOSSARY.md` | The settled words. Use them in code, UI and copy | Wins on naming |
| `docs/adr/0001` to `0005` | Five decisions that look wrong without context. Do not reverse them | Binding |
| `design/landing/15-bubbles/docs.html` (source: `docs/project.md` in the same folder) | The full product doc: problem, vision, every decision and the design history | Context |
| `BLUEPRINT.md` | The long-term vision. Much of it is deliberately out of scope | Background only |
| `design/landing/15-bubbles/` | The approved landing page (static HTML, CSS, `bubbles.js`) to port into the app | Design source |

When these disagree: `MVP.md` beats `BLUEPRINT.md`; the ADRs beat everything; this file fills in the "how".

### Rules for the builder

- The user leads product direction. Build what is specified. If something is unclear or looks wrong, ask; do not redesign.
- Keep enterprise concerns out (billing, quotas, roles, SSO) unless a section below asks for them.
- Never write secrets to the repo. `.env*` files are git-ignored.
- Use the glossary words exactly: Session, Session Version, Event, Transcript, Memory, Digest, Merge, Finding, Briefing, Guardrail, Proposed Guardrail, Approver, Push, Pull, Project, Workspace.

## 1. What we are building

Stash is shared memory for AI coding agents. A developer runs `stash push` inside Claude Code; Stash captures the session, removes secrets locally, uploads it, and the developer's own AI tool (Claude Code, Codex or any command) turns it into a Digest and typed Memories, stored in MongoDB Atlas. Another agent, on another laptop or another model, runs `stash pull <id>` and gets a Briefing: what was learned, what failed, what is still open, and the rules every agent must follow. `stash merge <a> <b>` reconciles two investigations. When the same failure shows up in two Sessions, Stash proposes a Guardrail that a human approves on the website.

The demo is two laptops, two agents, one Atlas cluster.

## 2. Hard constraints

| Constraint | Detail |
| --- | --- |
| Atlas | **Must be built in the hackathon Sandbox**: org "Agents in Context Toronto", the Sandbox project, `Cluster0` (M10, MongoDB 9.0.7, AWS, one region) |
| Embeddings | Atlas Automated Embedding, model `voyage-4`. No embedding API key anywhere. **Storage auto-scaling must be on** for Cluster0 or embedding pauses |
| Vector Search | One index on `memories`, used for merge, guardrails, pull and website search (section 8) |
| Language | TypeScript everywhere. One npm CLI and one Next.js app (website and API). No Python (ADR 0001) |
| LLM | No key anywhere. Every reasoning step runs on the developer's machine through their own AI tool: Claude Code, Codex, or any command (ADR 0005). The backend only validates, stores and searches |
| Pull | No LLM call at pull time. One `$vectorSearch` is allowed (ADR 0002) |
| Merges | Never modify source Sessions or Memories (ADR 0003) |
| Approvals | Only a human with the approver secret approves Guardrails or verifies Memories. The CLI is read-only for both (ADR 0004) |
| Secrets | Redacted in the CLI before upload. Never logged |
| Push support | Claude Code only. Any agent with a shell can pull |

## 3. Human setup (do these first, or ask the user to)

1. **Atlas, in the Sandbox project:**
   - Cluster0 → Edit configuration → enable **storage auto-scaling**.
   - Database & Network Access → add the IP of each demo laptop (or the venue network).
   - Create a database user for the backend (read/write on database `stash`).
   - Copy the `mongodb+srv://...` connection string.
2. **AI tool:** Claude Code installed and logged in on laptop 1; Codex (or Claude Code) on laptop 2. No API key.
3. **GitHub:** an empty repo for the demo app (`stash-demo`), cloned on both laptops.
4. **Each laptop:** Node 26, npm 11, Claude Code 2.1+, git.

## 4. Repository layout

npm workspaces in one repo. Turborepo is optional; plain `npm run -ws` is enough.

```text
stash/
├── apps/
│   ├── cli/                    # @stash/cli: the `stash` binary
│   │   └── src/
│   │       ├── index.ts        # commander entry
│   │       ├── commands/       # login, init, push, pull, merge, sessions, status, guardrails
│   │       ├── config.ts       # ~/.stash/config.json and ./.stash.json
│   │       ├── discover.ts     # find the Claude Code session file
│   │       ├── redact.ts       # secret scanning
│   │       ├── reason.ts       # extraction, merge and guardrail calls through the LLM adapter
│   │       ├── upload.ts       # batching, retries, progress lines
│   │       └── api.ts          # typed client for the web API
│   └── web/                    # Next.js App Router: website + API
│       ├── app/
│       │   ├── page.tsx                 # landing (port of 15-bubbles)
│       │   ├── docs/page.tsx            # private docs (renders docs/project.md)
│       │   ├── app/                     # the product UI (Home, Sessions, Memories, Merges, Guardrails)
│       │   └── api/                     # route handlers (section 9)
│       ├── lib/
│       │   ├── db.ts            # MongoClient singleton, collections, indexes
│       │   ├── auth.ts          # bearer token and approver secret checks
│       │   ├── ingest.ts        # validate and store extractions, merges, proposals
│       │   ├── guardrails.ts    # candidate search for repeated failures
│       │   ├── briefing.ts      # template, ranking, budget
│       │   ├── lineage.ts       # marker parsing
│       │   └── vector.ts        # every $vectorSearch lives here
│       └── scripts/seed.ts      # workspace, token, approver secret, indexes
├── packages/
│   ├── context-format/         # Universal Context Format types + zod schemas (shared by CLI and web)
│   ├── agent-adapters/         # reading sessions: claude-code (JSONL → UCF Events)
│   ├── llm-adapters/           # running the developer's AI tool: claude, codex, cmd
│   └── core/                   # ids, hashing, token estimate, marker regex, enums, prompts, zod schemas, validators
├── design/landing/             # design explorations (keep; 15-bubbles is the approved one)
├── docs/adr/
├── BUILD.md  MVP.md  GLOSSARY.md  BLUEPRINT.md
└── package.json                # workspaces: apps/*, packages/*
```

## 5. Stack

Versions current on npm as of 2026-11-14. Pin majors.

| Piece | Choice |
| --- | --- |
| Runtime | Node 26 |
| Language | TypeScript 7 |
| Web | Next.js 16 (App Router), React 19 |
| Database driver | `mongodb` 7 (official Node driver) |
| LLM | None on the server. The CLI spawns the developer's AI tool with `node:child_process` |
| Validation | `zod` 4 (shared schemas; `z.toJSONSchema` gives each AI tool its output schema) |
| CLI | `commander` 15, run with `tsx` in dev, built with `tsc` |
| Tests | `vitest` 5 |
| Fonts and look | Geologica, Vantage tokens from `design/landing/15-bubbles/tokens.css` |

## 6. Configuration

### Backend: `apps/web/.env.local`

```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="stash"
EMBED_MODEL="voyage-4"
VECTOR_INDEX="memories_vector"
```

Commit an `.env.example` with the same keys and empty values.

### CLI: `~/.stash/config.json` (per user, written by `stash login`)

```json
{
  "apiUrl": "http://localhost:3000",
  "token": "stash_...",
  "llm": { "tool": "claude", "model": "sonnet", "command": null, "maxInputTokens": null }
}
```

### Repo: `./.stash.json` (committed, written by `stash init`)

```json
{ "projectId": "prj_k3m9x", "workspaceId": "wsp_demo1", "remote": "github.com/<owner>/stash-demo" }
```

## 7. Data model (MongoDB, database `stash`)

IDs are short prefixed strings: `wsp_`, `prj_`, `ses_`, `mem_`, `m_` (merge), `g_` (guardrail), `p_` (pull) followed by 8 random base36 chars. Session Versions are integers per Session. Event IDs are content hashes so re-uploads never duplicate.

```ts
// packages/context-format/src/types.ts (abridged; zod schemas mirror these)

type EventType =
  | "user_message" | "assistant_message" | "tool_call" | "tool_result"
  | "file_read" | "file_change" | "error" | "branch_abandoned";

interface Workspace { _id: string; name: string; approverHash: string; createdAt: Date }
interface ApiToken { _id: string; workspaceId: string; tokenHash: string; label: string; createdAt: Date }

interface Project {
  _id: string; workspaceId: string; name: string;
  remote: string | null;          // normalized git remote, e.g. "github.com/owner/repo"
  createdAt: Date;
}

interface Session {
  _id: string; projectId: string; workspaceId: string;
  agent: "claude-code";
  nativeSessionId: string;        // Claude Code session UUID
  title: string;                  // first user message, trimmed to 80 chars
  latestVersion: number;          // 0 until first processed version
  eventCount: number;
  lineage: { sourceId: string; sourceType: "session" | "merge"; sourceVersion: number; pullId: string }[];
  machine: string;                // os.hostname(), for the demo's "laptop 1 / laptop 2"
  gitBranch: string | null; gitCommit: string | null;
  createdAt: Date; updatedAt: Date;
}

interface SessionVersion {
  _id: string;                    // `${sessionId}@v${n}`
  sessionId: string; projectId: string; version: number;
  eventCount: number; contentHash: string;   // sha256 of ordered event ids
  status: "processing" | "processed" | "failed";
  digest: Digest | null;
  extractedBy: { tool: "claude" | "codex" | "cmd"; model: string | null } | null;
  partial: boolean;               // Transcript was cut to fit the model
  redactedCount: number;
  createdAt: Date; processedAt: Date | null; error?: string;
}

interface Event {
  _id: string;                    // sha256(sessionId + ":" + nativeUuid + ":" + blockIndex), hex, 24 chars
  sessionId: string; projectId: string;
  seq: number;                    // order within the Transcript
  type: EventType;
  ts: Date;
  text?: string;                  // messages, errors
  tool?: { name: string; useId: string; input?: unknown; isError?: boolean };
  file?: { path: string; op: "read" | "write" | "edit" };
  output?: { excerpt: string; truncated: boolean; originalLength: number; sha256: string };
  sidechain: boolean;             // came from a subagent
}

interface Digest {
  objective: string;
  progress: string;               // where things stand, 1 to 3 sentences
  completed: { text: string; eventIds: string[] }[];
  openTasks: { text: string; eventIds: string[] }[];
  files: string[];
}

type MemoryType = "decision" | "discovery" | "failed_approach" | "constraint" | "open_question";
type MemoryStatus = "hypothesis" | "evidenced" | "verified";

interface Memory {
  _id: string; projectId: string; sessionId: string; version: number;
  type: MemoryType;
  text: string;                   // one sentence, descriptive, never an instruction. The embedded field
  status: MemoryStatus;
  eventIds: string[];             // at least one, all must exist in this Session
  current: boolean;               // true for the latest processed Version of its Session
  verifiedAt?: Date;
  createdAt: Date;
}

interface Merge {
  _id: string; projectId: string;
  sources: { sessionId: string; version: number }[];   // exactly two
  digest: Digest;
  findings: Finding[];
  extractedBy: { tool: string; model: string | null };
  createdAt: Date;
}
interface Finding {
  kind: "duplicate" | "complementary" | "conflicting" | "only_in_one";
  summary: string;
  memoryIds: string[];            // from either source
  eventIds: string[];
}

interface Guardrail {
  _id: string; projectId: string;
  rule: string;                   // imperative, one sentence: this is the only place instructions live
  rationale: string;
  status: "proposed" | "approved" | "rejected";
  evidence: { sessionId: string; memoryId: string; eventIds: string[] }[];  // from 2+ distinct Sessions
  pattern: string;                // short description of the failure pattern, used for "already covered"
  createdAt: Date; decidedAt?: Date;
}

interface Pull {
  _id: string; projectId: string;
  sourceId: string; sourceType: "session" | "merge"; sourceVersion: number;
  budget: number; tokensUsed: number;
  relatedMemoryIds: string[];     // what Vector Search added
  agentSessionHint: string | null; // CLAUDE_CODE_SESSION_ID if the puller ran inside Claude Code
  createdAt: Date;
}

interface AuditLog { _id: string; workspaceId: string; actor: "token" | "approver"; action: string; target: string; at: Date }
```

### Indexes (created by the seed script)

| Collection | Index |
| --- | --- |
| `sessions` | `{ projectId: 1, agent: 1, nativeSessionId: 1 }` unique; `{ projectId: 1, updatedAt: -1 }` |
| `session_versions` | `{ sessionId: 1, version: -1 }` |
| `events` | `{ sessionId: 1, seq: 1 }` |
| `memories` | `{ sessionId: 1, current: 1 }`; `{ projectId: 1, current: 1, type: 1 }` |
| `merges` | `{ projectId: 1, createdAt: -1 }` |
| `guardrails` | `{ projectId: 1, status: 1 }` |
| `projects` | `{ workspaceId: 1, remote: 1 }` unique (partial: remote exists) |
| `api_tokens` | `{ tokenHash: 1 }` unique |

### The Vector Search index

Create with the driver: `db.collection("memories").createSearchIndex({ name: "memories_vector", type: "vectorSearch", definition })`.

```json
{
  "fields": [
    { "type": "autoEmbed", "modality": "text", "path": "text", "model": "voyage-4" },
    { "type": "filter", "path": "projectId" },
    { "type": "filter", "path": "sessionId" },
    { "type": "filter", "path": "type" },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "current" }
  ]
}
```

Embeddings are generated asynchronously after insert, so a Memory is searchable a few seconds after it is written. Every query passes plain text and Atlas embeds it with the same model. Poll `listSearchIndexes()` until the index is `READY` in the seed script.

## 8. Vector Search: every query

All of these live in `apps/web/lib/vector.ts` and always filter on `projectId` and `current: true`.

```ts
// shape of every query
[
  { $vectorSearch: {
      index: "memories_vector", path: "text", query: "<text>",
      numCandidates: 150, limit: K,
      filter: { projectId, current: true, /* + per-query filters */ } } },
  { $project: { text: 1, type: 1, status: 1, sessionId: 1, eventIds: 1, score: { $meta: "vectorSearchScore" } } }
]
```

| Use | Query text | Extra filter | K | Then |
| --- | --- | --- | --- | --- |
| Merge candidates | each Memory of Session A | `sessionId: B` | 3 | pairs with score ≥ 0.75 are sent to the CLI as merge candidates |
| Guardrail detection | each new `failed_approach` Memory | `type: "failed_approach"`, `sessionId: { $ne: new }` | 5 | matches with score ≥ 0.80 from other Sessions are sent to the CLI for the evidence check |
| Pull: related | the pulled Digest's `objective` | `sessionId: { $nin: [source(s)] }` | 8 | dedupe by text, failed approaches first (section 12) |
| Website search | the user's question | optional `type`, `status` | 20 | group identical texts, show source Sessions |

Thresholds are starting points; log scores during the demo rehearsal and adjust. Measured on Cluster0 (2026-11-14, `apps/web/scripts/probe-vector.ts`): a related Memory scored 0.72 and an unrelated one 0.51 for a short question, and a new Memory was searchable about 4 seconds after insert. Scores run lower than the 0.75 and 0.80 above suggest, so calibrate those with real Memory-to-Memory pairs in M7 and M8. M7 measurement: Memory-to-Memory scores between two Sessions on the same bug ran 0.80 to 0.93 (30 pairs; the true duplicate scored 0.93), so 0.75 passed nearly everything. The merge cut-off is now 0.82 (`MERGE_CANDIDATE_MIN`); the model still judges every Memory, so candidates are hints, not decisions.

## 9. Web API (Next.js route handlers)

Every request except the landing and docs pages carries `Authorization: Bearer <stash token>`. `lib/auth.ts` hashes it (sha256), finds the token, and scopes every query to that Workspace. Approver actions also need `X-Approver-Secret`, checked against `workspace.approverHash` (scrypt). The server never calls an LLM; the CLI shows progress while the developer's AI tool works.

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /api/projects/init` | `{ remote?: string, name?: string }` | `{ projectId, workspaceId, created: boolean }`. Joins by normalized remote; with no remote, by name |
| `POST /api/sessions/resolve` | `{ projectId, agent, nativeSessionId, title, machine, gitBranch, gitCommit }` | `{ sessionId, latestVersion, knownEventIds: string[] }` (the CLI uploads only unknown events) |
| `POST /api/sessions/:id/events` | `{ events: Event[] }`, at most 500 events or 2 MB | `{ inserted, duplicates }`. Uses `bulkWrite` with `updateOne(upsert, $setOnInsert)` per event |
| `POST /api/sessions/:id/versions` | `{ contentHash, eventCount, redactedCount }` | `{ version, lineage }` with `status: "processing"`; records lineage (12.5). If `contentHash` equals the latest processed Version's, returns `{ unchanged: true, version }` and does nothing |
| `GET /api/sessions/:id/transcript?version=` | | Events in order (the CLI uses its local copy; this is for retries from another machine) |
| `POST /api/sessions/:id/versions/:n/extraction` | `{ digest, memories, extractedBy, partial }` | `{ memories: count, dropped: count }`. Validates (12.4), stores, switches current Memories |
| `GET /api/guardrails/candidates?sessionId=&version=` | | Matches for each new Failed Approach, their Events, and existing Guardrails (12.6) |
| `POST /api/guardrails` | `{ rule, rationale, pattern, evidence, extractedBy }` | the Proposed Guardrail; 422 if evidence spans fewer than 2 Sessions |
| `GET /api/sessions?projectId=` | | list, newest first |
| `GET /api/sessions/:id?version=` | | Session, Version, Digest, Memories, Events (paged), lineage |
| `POST /api/pull` | `{ sourceId, budget?: number, agentSessionHint?: string }` | `{ pullId, markdown, tokensUsed }` |
| `POST /api/merges/prepare` | `{ a: sessionId, b: sessionId }` | Versions, Digests, Memories, candidate pairs, cited Events (12.7) |
| `POST /api/merges` | `{ sources, digest, findings, extractedBy }` | `{ mergeId, counts }`; 409 if a source has a newer Version than prepared |
| `GET /api/merges/:id` | | Merge with Findings, both sources' Memories |
| `GET /api/guardrails?projectId=&status=` | | list |
| `POST /api/guardrails/:id/approve` and `/reject` | header `X-Approver-Secret` | updated Guardrail. 401 without a valid secret |
| `POST /api/memories/:id/verify` | header `X-Approver-Secret` | Memory with `status: "verified"` |
| `GET /api/search?projectId=&q=&type=&status=` | | Memories with scores and source Sessions |
| `GET /api/status` | | `{ db: "ok", index: "READY", workspace, projects }` |

Every write and every approval writes an `audit_logs` entry.

## 10. The CLI

Binary `stash`, package `@stash/cli`, installed locally with `npm link` for the demo.

| Command | Behaviour |
| --- | --- |
| `stash login [--token T] [--api URL]` | Prompts for the token if not given, calls `/api/status`, writes `~/.stash/config.json` |
| `stash init [--name N]` | Reads `git remote get-url origin`, normalizes it (strip protocol, `git@`, `.git`; lowercase host), calls `/api/projects/init`, writes `.stash.json`. No remote: requires `--name` or prompts |
| `stash push [--session ID] [--llm claude\|codex\|cmd]` | Section 11. Prints progress as checkmark lines |
| `stash pull <id> [--budget N] [--output FILE]` | Calls `/api/pull`, prints the Markdown to stdout; with `--output`, also writes the file. Sends `CLAUDE_CODE_SESSION_ID` as `agentSessionHint` when set |
| `stash merge <a> <b> [--llm claude\|codex\|cmd]` | Section 12.7. Shows progress, prints counts and the Merge id |
| `stash sessions` | Table: id, agent, version, events, memories, machine, updated |
| `stash status` | API reachable, token valid, Project, index status, last push |
| `stash guardrails` | Lists Guardrails with status. **No approve or reject subcommands, ever** |

Exit codes: 0 success, 1 user error (not logged in, no project), 2 server or network error after retries.

## 11. Push, step by step

### 11.1 Find the session file

Claude Code writes each session to `~/.claude/projects/<slug>/<sessionId>.jsonl`, where `<slug>` is the absolute working directory with every `/` (and `.`) replaced by `-`.

1. If `--session` is given, use `~/.claude/projects/*/<id>.jsonl`.
2. Else if `CLAUDE_CODE_SESSION_ID` is set (the CLI was run from inside Claude Code), use that id. `CLAUDECODE=1` confirms the agent.
3. Else list `*.jsonl` in this folder's slug directory, newest first. One candidate: use it after printing which. Several: show title (first user message) and time, ask the user to choose. None: exit 1 with a clear message.

Skip any session whose first user message starts with `stash:extract` (Stash's own reasoning calls). Never upload a session you are not sure about.

### 11.2 Parse the JSONL (adapter: `packages/agent-adapters/src/claude-code.ts`)

Each line is a JSON record. Keep only `type: "user" | "assistant"` (and `system` records with `level: "error"`). Ignore everything else (`queue-operation`, `attachment`, `api-request*`, `file-history-*`, `last-prompt`, `custom-title`, `agent-name`, `summary`, and any new type).

Useful fields on kept records: `uuid`, `parentUuid`, `isSidechain`, `timestamp`, `cwd`, `gitBranch`, `sessionId`, `message.content[]`, and on tool results `toolUseResult`.

**Pick the active branch.** Rewinds leave abandoned branches in the file.
1. Index kept records by `uuid`.
2. Take the last non-sidechain record in file order as the leaf.
3. Walk `parentUuid` from the leaf to the root; that chain is the Transcript.
4. For every record not on the chain whose `parentUuid` is on the chain, emit one `branch_abandoned` Event at that point ("a branch of N messages was abandoned here"). Do not include the abandoned records.
5. Sidechain records (subagents) whose ancestry joins the chain are kept, marked `sidechain: true`.

**Map content blocks to Events.**

| Block | Event |
| --- | --- |
| user `text` (not `isMeta`) | `user_message` |
| assistant `text` | `assistant_message` |
| assistant `thinking` | **dropped** (hidden reasoning is never portable) |
| assistant `tool_use` | `tool_call` with `tool.name`, `tool.useId`, `tool.input` (inputs larger than 4 KB are excerpted like outputs) |
| user `tool_result` | `tool_result` with `output` excerpt and `tool.isError`; if `is_error`, also emit `error` |
| `tool_use` named `Read` | also `file_read { path }` |
| `tool_use` named `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | also `file_change { path, op }` |

**Excerpt large outputs.** Over 4 KB: keep the first 2 KB and the last 1 KB, set `truncated: true`, keep `originalLength` and `sha256` of the full text. Error text is always kept in full up to 8 KB.

Event id: `sha256(nativeSessionId + ":" + record.uuid + ":" + blockIndex)` as hex, first 24 chars. `seq` is the position in the final Transcript.

### 11.3 Redact (in the CLI, before anything leaves the machine, including the prompt sent to the AI tool)

`apps/cli/src/redact.ts` scans every string field of every Event (text, tool inputs, outputs).

| Kind | Pattern |
| --- | --- |
| anthropic | `sk-ant-[A-Za-z0-9_-]{20,}` |
| openai | `sk-(proj-)?[A-Za-z0-9_-]{20,}` |
| aws | `AKIA[0-9A-Z]{16}` and `(?i)aws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+=]{40}` |
| github | `gh[pousr]_[A-Za-z0-9]{36,}` and `github_pat_[A-Za-z0-9_]{50,}` |
| mongodb | `mongodb(\+srv)?:\/\/[^\s"'@]+:[^\s"'@]+@` (replace credentials only) |
| jwt | `eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}` |
| private key | `-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----` |
| env values | every value of length 8 or more found in `.env`, `.env.*` (not `.env.example`) under the repo root |

Each match becomes `[REDACTED:<kind>]`. Count **distinct** secret values. If scanning throws, abort the push: upload nothing. Never print a secret, even in debug output.

### 11.4 Upload

1. `resolve` the Session; get `knownEventIds`.
2. Send unknown Events in batches of up to 500 or 2 MB. Retry each batch up to 3 times with backoff (1s, 3s, 9s). Re-sending is safe because Event ids are stable.
3. `POST versions` with `contentHash` = sha256 of the ordered Event ids. If unchanged, print `No changes detected. Already up to date (vN).` and exit 0.
4. Run extraction locally (12.4), upload it, then run the guardrail check (12.6). Print progress as lines:

```text
✓ Capturing session          claude-code 6f2e…  148 events
✓ Scanning for secrets       1 redacted
✓ Uploading transcript       148 events
✓ Reasoning locally          claude (sonnet)
✓ Generating Digest
✓ Extracting Memories        12 found
✓ Recording lineage          continued from ses_8kq2v@v2
✓ Checking repeated failures 1 Guardrail proposed

Push complete.  Session ses_4m2pq  Version 2
```

## 12. Reasoning on the developer's machine

Stash has no LLM key (ADR 0005). The CLI runs the developer's own AI tool for every reasoning step and uploads the structured result. The server validates and stores it. Prompts, zod schemas and validators live in `packages/core` so the CLI and the server use the same rules.

### 12.1 LLM adapters (`packages/llm-adapters`)

```ts
export type LlmTool = "claude" | "codex" | "cmd";

export interface LlmRequest {
  system: string;            // stable instructions
  prompt: string;            // the rendered Transcript or merge material
  schema: object;            // JSON Schema from z.toJSONSchema(ZodSchema)
  timeoutMs: number;         // default 300_000
}

export interface LlmAdapter {
  tool: LlmTool;
  detect(): Promise<boolean>;                                  // installed and runnable
  maxInputTokens: number;                                      // used to fit the Transcript
  run(req: LlmRequest): Promise<{ text: string; model: string | null }>;
}
```

| Adapter | How it runs (prompt always on stdin, spawned with `node:child_process`, never through a shell) |
| --- | --- |
| `claude` | `claude -p --output-format json --json-schema '<schema>' --no-session-persistence --model <model, default sonnet> --system-prompt '<system>'`, with tools turned off (`--restricted`, or `--tools ""`; confirm with `claude --help`, verified on 2.1.318). Read the JSON envelope: the structured object when present, else parse `result`. Take the model name from the envelope. `maxInputTokens` 150k |
| `codex` | `codex exec --skip-git-repo-check --sandbox read-only --output-schema <tmp schema file> -o <tmp out file> -`; read the out file. Not installed on laptop 1, so confirm the flags with `codex exec --help` before writing it. `maxInputTokens` 150k |
| `cmd` | Any command saved in config (for example `ollama run qwen3`). Send system + schema + prompt + "Reply with one JSON object and nothing else." Take the first complete JSON object from stdout. `maxInputTokens` from config, default 24k |

**`--no-session-persistence` is required for `claude`.** Without it, Stash's own extraction calls are saved as Claude Code sessions in the same folder, and the next `stash push` could pick one up. As a backstop, session discovery (11.1) skips any session whose first user message starts with `stash:extract`, and every Stash prompt starts with that marker.

**Choosing the adapter, first match wins:** `--llm <tool>` flag; the agent Stash is running inside (`CLAUDECODE=1` means `claude`; Codex's environment marker, if it sets one, means `codex`); `llm.tool` in `~/.stash/config.json`; otherwise detect the installed tools, ask once, and save the answer. `--llm cmd` asks for the command once and saves it. If nothing is available, exit 1 with how to install Claude Code or Codex, or how to set a command.

On timeout, kill the process and report it. Never print the tool's stderr unless `--debug`.

### 12.2 Structured calls (`runStructured`)

1. Build the JSON Schema from the zod schema with `z.toJSONSchema`.
2. Run the adapter; `JSON.parse` the text; `Schema.safeParse` it.
3. If parsing fails, retry once with the validation error appended ("Your last reply failed validation: …"). If it fails again, stop with a clear error. Events are already uploaded, so running `stash push` again retries only the processing.

### 12.3 Rendering a Transcript for the model

One line per Event, oldest first: `[e:<id>] <type> <tool name if any>: <text or excerpt>`. The ids let the model cite evidence. Estimate tokens as `ceil(chars / 4)`. If it exceeds the adapter's `maxInputTokens`: shorten older tool output excerpts to 300 characters; if still too big, keep every `error` and `user_message` Event plus the most recent Events that fit, mark the Version `partial: true`, and print a warning naming a bigger model. Never drop an Event silently: dropped ranges become one line, `[… 212 events omitted …]`.

### 12.4 Digest and Memories (one call per Session Version)

Schema (zod, in `packages/core`):

```ts
const Extract = z.object({
  digest: z.object({
    objective: z.string(),
    progress: z.string(),
    completed: z.array(z.object({ text: z.string(), eventIds: z.array(z.string()).min(1) })),
    openTasks: z.array(z.object({ text: z.string(), eventIds: z.array(z.string()) })),
    files: z.array(z.string()),
  }),
  memories: z.array(z.object({
    type: z.enum(["decision", "discovery", "failed_approach", "constraint", "open_question"]),
    text: z.string(),
    status: z.enum(["hypothesis", "evidenced"]),
    eventIds: z.array(z.string()).min(1),
  })).max(40),
});
```

System prompt essentials (write it in full in `packages/core/src/prompts/extract.ts`):
- Start with the marker `stash:extract`.
- You are given the Transcript of one coding-agent session. Extract what the next agent needs to continue.
- Memories describe; they never instruct. Write "Hand edits to generated.ts were overwritten by the build", never "Don't edit generated.ts".
- One idea per Memory, one sentence, specific: files, functions, commands, error messages.
- `evidenced` only when a cited Event directly shows it (a tool result, an error, a test output). Anything inferred is `hypothesis`.
- Every Memory and every completed item cites real Event ids from the Transcript.
- Failed approaches say what was tried and why it did not work.
- Do not invent anything not in the Transcript.

**Validate (`validateExtraction`, run by the CLI before upload and again by the server):** drop any eventId that is not in this Session; drop a Memory left with no eventIds; downgrade `evidenced` to `hypothesis` unless at least one cited Event is a `tool_result`, `error` or `file_change`; rewrite Memories that start with an imperative (`Do `, `Don't`, `Never`, `Always`, `Use `, `Avoid `) as "The agent found that …".

**Upload:** `POST /api/sessions/:id/versions/:n/extraction` with `{ digest, memories, extractedBy: { tool, model }, partial }`. The server validates again, then in one sequence: inserts the Memories with `current: false`; sets the Version's `digest`, `extractedBy` and `status: "processed"`; runs `updateMany({sessionId, current: true}, {$set:{current:false}})` and `updateMany({sessionId, version: n}, {$set:{current:true}})`; sets `sessions.latestVersion = n`. A failed run leaves the previous Version current.

### 12.5 Lineage (server)

Regex (in `packages/core`): `/stash:briefing (ses_[a-z0-9]+|m_[a-z0-9]+)@v(\d+) pull=(p_[a-z0-9]+)/g`. When a Version is created, the server scans the Session's `tool_result` outputs. For each match whose `pullId` exists in `pulls` and belongs to this Project, it adds a lineage entry (deduplicated by `pullId`). Several matches mean several parents.

### 12.6 Guardrail proposals (after every processed push)

1. CLI: `GET /api/guardrails/candidates?sessionId=&version=`. For each new `failed_approach` Memory, the server runs the guardrail Vector Search (section 8; the query is the Memory's text, so the new Memory need not be embedded yet). It returns matches from **other** Sessions with score ≥ 0.80, their cited Events (excerpts), and every Guardrail of the Project (any status) with its `pattern` and `rule`. No matches: stop.
2. CLI: one structured call per new failure that has matches. Schema: `{ samePattern: boolean, coveredBy: string | null, proposal: { rule, rationale, pattern } | null }`. The prompt asks whether these are genuinely the same failure, judged on the evidence, not the wording. The rule is the one place an instruction is allowed.
3. If `samePattern` and not `coveredBy`: `POST /api/guardrails` with `{ rule, rationale, pattern, evidence, extractedBy }`. The server checks that the evidence spans 2 or more distinct Sessions and that every cited Memory and Event exists, then inserts it as `proposed`. A pattern covered by a rejected Guardrail is never proposed again.

### 12.7 Merge

1. CLI: `POST /api/merges/prepare { a, b }`. The server picks each Session's latest processed Version and returns both Digests, both current Memory lists (ids, type, status, text), the candidate pairs from Vector Search (section 8) with scores, and the Events cited by candidate pairs (excerpts).
2. CLI: one structured call. Schema: `{ digest: Digest, findings: [{ kind, summary, memoryIds, eventIds }] }`. Prompt rules: judge by evidence, not by majority; a conflict stays a conflict when the evidence does not settle it; every Memory of either source appears in at least one Finding.
3. CLI: `POST /api/merges { sources: [{sessionId, version}, {sessionId, version}], digest, findings, extractedBy }`. The server checks that the Versions are still the latest processed ones and every id exists, then stores the Merge. **Nothing writes to the source Sessions or Memories.**

## 13. Pull and the Briefing (`apps/web/lib/briefing.ts`)

No LLM call. Steps:

1. Resolve the source: a Session (its latest processed Version) or a Merge.
2. Gather: approved Guardrails of the Project; the Digest; current Memories (or the Merge's Findings); related Memories from other Sessions (Vector Search on the objective, section 8); up to 6 key Events (those cited most often, `error` and failing `tool_result` first).
3. Rank and fit the budget (default 6,000 tokens; estimate tokens as `ceil(chars / 4)`; deterministic). Drop order, first dropped first: key evidence beyond 2 items, related Memories, open questions, constraints, discoveries with status hypothesis, the rest of discoveries, decisions, failed approaches. **Never drop Guardrails, the marker, or the objective.**
4. Insert a `pulls` document and render:

```markdown
stash:briefing ses_8kq2v@v2 pull=p_91x7k2ma

# Briefing: Investigate intermittent login failures
From Claude Code on laptop-1, Version 2, pushed 14 Nov 2026 14:12. Project stash-demo.

## Rules every agent follows (approved)
- Edit schema/api.yaml and run `npm run generate`; never edit src/client/generated.ts by hand.

## Where things stand
<objective> · <progress>

## Decisions
- Investigate token refresh before the cache. [evidenced] (e_3f…, e_91…)

## Discoveries
- Refresh fires twice under concurrent requests. [evidenced] (e_14…)

## Failed approaches (do not retry)
- Raising the db timeout to 30s changed nothing; same 3 failures. [evidenced] (e_22…)

## Constraints
## Open questions and next steps

## Related from other sessions
- The cache serves a session after it expires. [hypothesis] from ses_3mx7r (cache investigation)

## Key evidence
- e_14 tool_result npm test: "3 failed … refresh() called twice"

Ask for more: stash pull ses_8kq2v --budget 12000
```

Status tags are always shown. Empty sections are omitted (the template order never changes). For a Merge, "Discoveries" and friends are replaced by "Findings" grouped by kind, conflicts first.

## 14. Website

### 14.1 Landing page (`/`)

Port `design/landing/15-bubbles/` into `app/page.tsx`:
- Copy the tokens (`tokens.css`, `base.css`, `../vantage-shared/vantage.css`, `page.css`) into a CSS module or global stylesheet; keep the token names.
- `bubbles.js` becomes a client component (`"use client"`) that mounts the same engine on a canvas; keep its behaviour exactly (the loop, the drift, the fade behind the head, reduced motion, pause off screen). Keep its options object updated on resize as the static page does.
- Copy is final: hero "Your agents forget. Stash remembers."; the problem statement; how it works (push, pull, merge, learn rows); "Git shares code. Stash shares the context behind it." with the handoff.md vs Stash table; "Never write a handoff.md again." with the install command.
- Nav: How it works, Why, Docs, Install.

### 14.2 Docs (`/docs`)

Render `docs/project.md` (move it into `apps/web/content/project.md`) with a markdown renderer at build time; keep the contents rail and the collapsed appendices. `noindex`. Link this `BUILD.md` from it.

### 14.3 The app (`/app`)

Five pages, Vantage look, server components reading Mongo directly through `lib/db.ts`:

| Page | Shows |
| --- | --- |
| `/app` Home | Counts (Sessions, Memories, Merges, Guardrails proposed) and recent activity from `audit_logs` |
| `/app/sessions` and `/app/sessions/[id]` | List; detail with Digest, Memories by type with status, each evidence id linking to its Event in a Transcript panel, and the lineage chain (parents and children) |
| `/app/memories` | Search box (Vector Search), type and status filters, **Verify** button (approver secret) |
| `/app/merges/[id]` | Two sources side by side, Findings coloured by kind, conflicts first |
| `/app/guardrails` | Proposed and Approved, evidence per Session, **Approve** and **Reject** (approver secret) |

**Approver secret UX:** the first approver action opens a dialog asking for the secret. Keep it in React state only (not localStorage, not a cookie); send it as `X-Approver-Secret`. The server checks it on every approver request.

The website has no login in the MVP; the app pages read the seeded Workspace (the token in the server's env is not needed for server components; API routes still require a token for CLI calls).

## 15. Seed script (`apps/web/scripts/seed.ts`, run with `npx tsx`)

1. Connect with `MONGODB_URI`.
2. Create Workspace `wsp_demo1` with `approverHash = scrypt(<prompted secret>)`.
3. Create an API token `stash_<32 random base62>`, store its sha256, **print it once**.
4. Create all indexes (section 7) and the `memories_vector` Vector Search index; poll until `READY`.
5. Idempotent: running it twice does not duplicate anything (upserts by id).

## 16. Demo repo (`stash-demo`, separate GitHub repo)

A small TypeScript API (Express or Fastify) that two agents can genuinely investigate.

1. **Intermittent login failure, two testable causes:**
   - `src/auth/refresh.ts`: token refresh has a race; two concurrent requests both refresh, and the second invalidates the first.
   - `src/cache/session.ts`: the session cache returns entries after expiry (TTL compared in the wrong unit).
   - `npm test` has a flaky login test that fails about 1 in 4 runs; separate tests can confirm each cause.
2. **Generated client:** `schema/api.yaml` → `npm run generate` → `src/client/generated.ts`. `npm run build` regenerates first, so hand edits are overwritten; a CI check fails when the file differs from the generator output.
3. **A fake secret:** `.env` with `ANTHROPIC_API_KEY=sk-ant-demo-...` (fake) that the app reads at startup, so an agent will likely `cat` it.
4. `README.md` with the bug report: "Users get logged out at random. Find out why."

**Built (M2): `github.com/haris-sujethan/stash-demo`, cloned at `~/Desktop/stash-demo`.** Answer key, kept here so agents working in the demo repo never see it:
- **Cause 1, refresh race (`src/auth/tokens.ts`):** two requests after expiry both refresh with the same refresh token. The identity provider (`src/auth/idp.ts`) treats reuse as theft and revokes the whole family, so both fail. Fix: one refresh in flight per session.
- **Cause 2, stale cache (`src/api.ts` + `src/cache/ttl-cache.ts`):** `TtlCache` takes seconds, but `/me` passes `profileTokenCacheMs` (30,000), so cached tokens live about 8 hours and `/me` keeps using an expired one. Fix: pass seconds, and never cache past the token's own expiry.
- **Red herring:** the README says ops blames database timeouts; `DB_TIMEOUT_MS` changes nothing.
- **Generated client:** `src/client/generated.ts`. `npm run build` regenerates it and `npm run check:generated` (also in CI) fails on hand edits. An agent that patches `refreshSession` there, rather than `tokens.ts`, triggers the Guardrail story.
- Measured: the login test fails 9 of 30 runs. With both fixes it passes 20 of 20.

## 17. Milestones (build in this order)

Each milestone ends with its check passing. Commit after each.

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Workspace scaffold: npm workspaces, TS config, lint, vitest, `.env.example` | `npm run build` and `npm test` pass on an empty project |
| M1 | Atlas: seed script, indexes, vector index | `seed` prints a token; `/api/status` reports `index: READY` |
| M2 | Demo repo created and pushed to GitHub | Flaky test fails sometimes; each cause has a failing focused test; generator overwrites hand edits |
| M3 | Claude Code adapter + redaction (packages, pure functions) | Unit tests on fixture JSONL: active branch chosen, abandoned branch event emitted, thinking dropped, Read/Edit become file events, a planted key becomes `[REDACTED:anthropic]` and counts once |
| M4 | `login`, `init`, push upload path, `sessions`, `status` | Pushing a real session stores Events; pushing again uploads 0 and prints "Already up to date" |
| M5 | LLM adapters (`claude`, `codex`, `cmd`) + extraction, Version switching | A push produces a Version with Digest and 5 to 40 cited Memories, `extractedBy` set; every eventId exists; no imperative Memories; the `cmd` adapter passes with a fake command; Stash's own `claude -p` calls never show up as sessions |
| M6 | `pull` and the Briefing (incl. related Memories via Vector Search) | Briefing renders in under 1 s, respects `--budget`, includes the marker, never drops Guardrails |
| M7 | `merge` | Merge of two demo Sessions shows at least one duplicate and one conflict, with evidence; sources unchanged (verify by hash before and after) |
| M8 | Guardrail proposals | Two Sessions that both hand-edit the generated client produce one Proposed Guardrail with evidence from both; a third does not duplicate it |
| M9 | Website app pages + approver flow | Approve without the secret returns 401; with it, the rule appears in the next `pull` |
| M10 | Lineage | Laptop 2 pulls ses_A, works, pushes ses_B; ses_B shows "continued from ses_A@v2" on the website |
| M11 | Landing page port + `/docs` | Landing matches `design/landing/15-bubbles` visually; docs render with the rail |
| M12 | Record real demo sessions, rehearse twice | The run sheet below works end to end on two laptops |

Cut order if behind: Home page → `sessions`/`status` polish → lineage chain on the website (keep the data) → Verify button. Never cut push, pull, merge or Guardrails.

Stretch, only after M12: Okta/Auth0 login; an MCP server exposing `stash_pull` and `stash_search`; auto-push from a Claude Code `SessionEnd` hook; a Codex push adapter; a Gemini CLI LLM adapter; chunking long Sessions for small models.

## 18. Testing

- **Unit (vitest):** adapter (fixtures copied from real, redacted session files), redaction patterns, event id stability, token estimate, budget fitter (drop order, never drops Guardrails), marker regex, memory validator.
- **Integration:** against a separate database `stash_test` on the same cluster: push → version → memories current flag switch; idempotent re-push; merge leaves sources unchanged; approve requires the secret.
- **LLM adapters in tests:** default runs use a fake command (a node script that prints fixture JSON) through the `cmd` adapter, plus envelope fixtures for `claude` and `codex`. Real tools run only with `RUN_LLM_TESTS=1`.
- **Manual:** the run sheet.

## 19. Demo run sheet

1. Laptop 1, `stash-demo`, Claude Code: "Users get logged out at random. Find out why." Let it find the refresh race. `! stash push` → shows 1 secret redacted, Memories extracted by Claude.
2. Laptop 2, a fresh agent session (Codex if installed, to show cross-LLM): `stash pull <ses_A>` → the agent continues without re-investigating; it does not retry the db timeout.
3. Laptop 2's agent investigates the cache and pushes (push captures Claude Code sessions, so this one runs in Claude Code; `--llm codex` does the reasoning with Codex) → the website shows "continued from ses_A" and "extracted by codex".
4. `stash merge ses_A ses_B` → the Merges page: duplicate refresh finding, complementary cache finding, the database conflict.
5. Both sessions had hand-edited the generated client → Guardrails page shows a Proposed Guardrail with evidence from both. Approve it with the secret.
6. `stash pull ses_B` → the rule now leads the Briefing.
7. `stash push` again → "Already up to date". Click any Memory → its source Event.

## 20. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Automated Embedding lags inserts by seconds | Vector Search only runs on Memories from earlier pushes, or after polling; push shows "indexing" before the guardrail check if needed |
| Storage auto-scaling left off | `status` checks the index state and prints a clear warning if it is stale |
| Local extraction is slow on stage | Progress lines; pre-record sessions; `--model sonnet`, not the largest model |
| An AI tool changes its CLI flags | Each tool is one small adapter; confirm flags with `--help`; `cmd` works as a fallback with any tool |
| Stash's own `claude -p` calls become sessions | `--no-session-persistence`, plus discovery skips sessions starting with `stash:extract` |
| A modified CLI uploads invented Memories | Server re-validates every citation; Guardrails still need a human; stated as a known limitation |
| Claude Code JSONL format changes | The adapter keeps an allow-list and ignores unknown records; fixture tests catch breaks |
| Wrong session uploaded | Discovery rules in 11.1; always print which session before upload |
| Secrets leak | Redaction before batching; tests with planted keys; abort on scanner error |
| Agent approves its own rule | CLI has no approve command; server requires the approver secret; the secret is never on disk |
| Local backend holds Atlas credentials | Accepted for the hackathon and said plainly in the pitch; production would host the backend |

## 21. Open items for the user

- Confirm Cluster0 has storage auto-scaling on, the laptops' IPs are allowed, and a database user exists.
- Put the Atlas connection string in `apps/web/.env.local` (no other secret is needed).
- Have Claude Code logged in on laptop 1, and Codex or Claude Code on laptop 2.
- Create the `stash-demo` GitHub repo.
- Confirm whether code written before the event is allowed.
