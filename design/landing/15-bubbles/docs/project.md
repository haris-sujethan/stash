# Stash, Full Project Scope

Last updated 2026-11-14. A private copy of everything about Stash, kept on the site while it is unpublished.

## 1. Overview

Stash is shared memory infrastructure for AI agents: it captures an agent's working session, stores it in MongoDB Atlas, and lets another agent, developer or LLM pick it up and continue.

**The one-liner:** Git shares code and code history. Stash shares the context, evidence, decisions and experiences behind agents' work.

**Why it matters:** hundreds of thousands of developers use coding agents every day. When those sessions end, the context behind the work (files read, commands run, approaches ruled out, decisions and their reasons) is lost and never reused.

### The problem

- **Isolated sessions.** What an agent learns lives in its own session history. The next agent starts from zero.
- **Repeated investigations.** Agents re-check causes that were already ruled out and retry approaches that already failed. That wastes time, tokens and compute.
- **No shared project memory.** Knowledge is scattered across local session files, chat histories, handoff docs, different providers and individual laptops.
- **Lossy handoffs.** A handoff doc gives a summary. It drops the tool outputs, the sequence of events, the failed experiments and the evidence.
- **Repeated mistakes.** Agents keep editing generated files, breaking conventions and hitting rate limits. Nothing turns those failures into evidence-backed rules.

### The answer

Three commands are the core of the product:

```bash
stash push                          # publish this agent session
stash pull <session-id>             # give its context to another agent
stash merge <session-a> <session-b> # reconcile two investigations
```

Developers use Stash mainly through the CLI. A website is where they browse, search, approve and see everything that's stored.

**What Stash is not:** another chatbot memory feature, or a replacement for each agent's own memory. It is a shared layer that connects them.

**Where the design lives in the repo:** BLUEPRINT.md is the long-term vision, MVP.md is the 24-hour build, GLOSSARY.md defines the terms, and docs/adr holds four decision records. This doc combines all of them with every decision we made in chat. Where it differs from BLUEPRINT.md, the MVP decisions win.

## 2. The hackathon

Stash is our entry for **Agents in Context Toronto: a MongoDB Hackathon**, a one-day, in-person event with teams of up to four. The build window is 24 hours.

**The brief, which works as the rubric:** the next breakthroughs come from agents that

1. hold context across sessions,
2. adapt their own guardrails,
3. operate reliably under real workloads,

built with MongoDB Atlas, Vector Search and agentic memory tooling. Projects should go past demos and become durable infrastructure that future agents run on.

### How Stash answers each part of the brief

| Brief asks for | Stash shows it with |
| --- | --- |
| Context across sessions | `push` on laptop 1, `pull` on laptop 2: a different agent continues the work. Session Lineage records the hand-off. |
| Adapting their own guardrails | A failure repeated across Sessions becomes a Proposed Guardrail. A human approves it, and every later Briefing includes it. |
| Reliable under real workloads | Idempotent pushes, immutable Events, versioned Sessions, provenance on every Memory, and secrets redacted locally |
| Infrastructure, not a demo | A CLI and a shared store any agent can use, with a model-independent format |
| Atlas, Vector Search, memory tooling | Atlas holds everything. Automated Embedding plus Vector Search power merge, Guardrail detection and search. |

## 3. Long-term vision (the original blueprint)

This is the product as originally laid out in BLUEPRINT.md. The hackathon builds a slice of it (section 4). Where the two differ, the MVP decisions in sections 4 to 18 win.

### Five core capabilities

1. **Context portability:** move working context between sessions, machines, developers and different LLMs.
2. **Persistent memory:** a searchable knowledge base built from accumulated agent sessions.
3. **Intelligent merging:** combine independent agent histories, keeping their evidence, disagreements and provenance.
4. **Adaptive guardrails:** learn from past failures and propose project-specific rules for future agents.
5. **Reliable context infrastructure:** keep history, track versions, manage permissions, and retrieve what's relevant without overwhelming agents.

### Full CLI (vision)

`stash login`, `logout`, `init`, `push`, `pull <session-id>`, `pull --project`, `merge <a> <b>`, `sessions`, `search "<query>"`, `memory`, `guardrails`, `status`, `config`. It would ship as an npm package (illustrative name `@stash/cli`).

### Full website (vision)

- **Dashboard:** projects, recent sessions, memory count, recent merges, agent activity, guardrail activity.
- **Sessions:** browse sessions and their histories, inspect tool calls, trace any item back to its source.
- **Memory Explorer:** search across sessions, ask questions about past work, browse by type, inspect evidence.
- **Merge Explorer:** pick sessions, see related findings and disagreements, inspect sources.
- **Guardrails:** review, approve or reject, see the motivating sessions, manage expiry.
- **Project and Access Management:** projects, invites, permissions, audit history.

### Cross-LLM portability

Every agent stores sessions in its own format. Stash converts accessible history into a **Universal Context Format** using an **adapter** per agent: Claude Code → adapter → universal format → storage → universal format → target adapter → target agent. Hidden model reasoning and internal state are never transferred. Where an agent supports restoring its own native sessions, Stash can use that; otherwise it builds a package the target agent can read.

### Persistent memory (vision)

The vision listed eight memory types (decisions, discoveries, failed approaches, constraints, architecture, lessons, open questions, guardrails). Each memory had an ID, project and session references, source events, type, content, confidence, verification status, timestamps, an embedding and provenance. Lifecycle: session → event extraction → memory extraction → dedup and validation → Atlas → semantic retrieval → future agent context. A model-generated summary must never silently become an established fact.

### Merge pipeline (vision)

Extract → retrieve related items with Vector Search → compare (duplicates, complementary, contradictory, different approaches, repeated failures) → reconcile with an LLM against the original evidence, never by majority vote → generate a unified briefing → keep lineage. Sources are never changed.

### Adaptive guardrails (vision)

Observe → identify patterns → propose → validate against existing policy → human approval → apply in future context. Each guardrail has an ID and version, description, evidence, source sessions, scope, approval status, creation date, expiry or review date, and an audit history. Security policies stay separate from learned preferences, and agents can never weaken controls, grant themselves permissions or override approved restrictions.

### Reliability and security requirements (vision)

Versioning and lineage; concurrency (atomic updates, version checks); provenance; access control enforced at retrieval; secret redaction before upload; context budgeting; stale-memory detection; idempotent, retryable ingestion; and an audit of every push, pull, merge and approval.

### Original architecture (superseded for the MVP)

The blueprint proposed a TypeScript CLI, a Python FastAPI backend, Atlas with Vector Search, an embedding provider, LLM-based processing, a React website, token auth and cloud hosting. Collections were projects, sessions, events, memories, merges, guardrails and audit\_logs. Section 6 records what replaced it.

### How Stash differs

| Capability | Handoff doc | Individual agent memory | Stash |
| --- | --- | --- | --- |
| Save session summaries | Yes | Sometimes | Yes |
| Preserve accessible event history | Limited | Provider-dependent | Yes |
| Cross-LLM portability | Manual | Limited | Core feature |
| Shared project memory | Manual | Usually isolated | Yes |
| Search across agents | No | Limited | Yes |
| Merge independent histories | Manual | No | Core feature |
| Evidence and provenance | Limited | Varies | Core feature |
| Learned project guardrails | Manual | Varies | Core feature |
| Shared team context | Manual | Limited | Yes |

A handoff doc tells an agent what happened. Stash gives agents what happened, why, the original evidence, what failed and what other agents learned.

## 4. Hackathon MVP scope

The MVP shows the core idea through one complete workflow: two agents, two laptops, one shared Project. It does not try to build the whole platform.

| # | Feature | What the demo proves |
| --- | --- | --- |
| 1 | Session capture | A Claude Code integration reads accessible session history: messages, tool calls and results, file interactions, metadata. Decisions, discoveries and failed approaches are extracted as Memories, not stored as Events. |
| 2 | Push to Atlas | `stash push` stores Events and metadata, builds a Digest and Memories, and Atlas embeds them automatically. |
| 3 | Cross-LLM pull | `stash pull <id>` gives another agent a useful Briefing, not a giant Transcript. |
| 4 | Intelligent merge | `stash merge <a> <b>` on two real Sessions finds related, duplicate and conflicting findings, keeps the evidence, and produces one Digest. |
| 5 | Adaptive guardrails | A failure repeated across Sessions becomes a Proposed Guardrail. A human approves it with a simple workflow, and the next agent receives it. |
| 6 | Website | A lightweight app showing Sessions, Memories, search results, Merges and Guardrails, so the value shows immediately. |

### In scope vs deferred

| Area | In the MVP | Deferred |
| --- | --- | --- |
| Agents that can push | Claude Code | Codex and other adapters |
| Agents that can pull | Any agent with a shell | Native session restore |
| CLI | login, init, push, pull, merge, sessions, status, guardrails (read-only) | pull --project, search, memory, logout, config |
| Auth | Seeded Workspace, Stash token, approver secret | Real login (Okta/Auth0 is the stretch goal), invites, roles |
| Memory | Five types, versioned per Session, three statuses | Project-wide consolidation, stale-memory detection |
| Guardrails | Propose, approve or reject, include in Briefings | Expiry, versioning, separate security policies |
| Hosting | Next.js runs locally on each laptop, with Atlas in the cloud | Hosted backend (Vercel or similar), usage quotas, billing |
| Website | Home, Sessions, Memories, Merges, Guardrails, plus the public landing page | Workspace and access management, audit views |

**Rule for scope questions:** if a problem only matters for a serious enterprise integration, it's out of scope for now. A regular user should never have to hand Stash an LLM key: reasoning runs through the AI tool they already use (ADR 0005).

## 5. Glossary

These are the settled words. Use the term in the first column, and avoid the words in the last column.

| Term | Meaning | Avoid |
| --- | --- | --- |
| Workspace | A team or personal account that owns Projects | Organization, account, team |
| Project | One shared codebase in a Workspace, identified by its repository rather than a local clone | Repo, workspace |
| Agent | An AI coding tool that does work and produces Sessions (Claude Code, Codex) | Model, bot, assistant |
| Session | One continuous conversation with an Agent. One native session maps to exactly one Session. | Conversation, chat, run |
| Session Version | A snapshot of a Session at push time. Exists only when there are new Events. | Revision, snapshot |
| Event | One thing that observably happened: a message, tool call, tool result, file read or change, or error. Never edited, never interpreted. | Log entry, record, step |
| Transcript | A Session's complete, normalized, ordered Events, with secrets removed | History, log, raw session |
| Universal Context Format | The model-independent shape of every Transcript and Digest | Context package, unified context |
| Memory | One piece of knowledge interpreted from Events, citing them as evidence. Belongs to one Session Version and is never worded as an instruction. | Fact, note, insight, lesson |
| Memory Type | Decision, Discovery, Failed Approach, Constraint or Open Question | Lesson, architecture, category |
| Memory Status | Hypothesis (inferred), Evidenced (an Event shows it) or Verified (a human confirmed it) | Confidence, score, certainty |
| Digest | Structured summary of a Session or Merge (objective, work done, decisions, discoveries, failed approaches, open tasks) with evidence references | Summary, handoff, context package |
| Merge | An immutable artifact reconciling specific Versions of two Sessions into one Digest plus Findings | Combined session, unified context |
| Finding | One comparison inside a Merge: Duplicate, Complementary, Conflicting or Only in one source. A Conflicting Finding is what "disputed" means. | Diff, comparison, conflict |
| Briefing | What an Agent receives on pull: built from a Digest, Memories, Events and approved Guardrails, sized to its context window | Context package, prompt, handoff doc |
| Session Lineage | The record that a Session continued from a pulled Session or Merge, at an exact Version | Parent, ancestry, history |
| Guardrail | An evidence-backed rule shaping future Agents in a Project. Reaches Agents only once approved by a human. | Policy, constraint, lesson |
| Proposed Guardrail | A Guardrail suggested by Stash but not yet approved. Never reaches an Agent. | Draft rule, suggestion |
| Approver | A human who can approve Guardrails and verify Memories. An Agent can never be one. | Admin, reviewer, owner |
| Push | Publishing a Session's new Events, which creates a new Session Version. Pushing an unchanged Session does nothing. | Upload, sync, save |
| Pull | Producing a Briefing from a Session or Merge for the Agent working now | Download, restore, resume |

**How the three "context" words relate:** a Transcript is *what happened*. A Digest is *what was learned*. A Briefing is *what the next agent receives*.

## 6. Architecture and stack

The stack is TypeScript everywhere: an npm CLI plus one Next.js app that serves both the website and the API, sharing types through a monorepo (ADR 0001). The developer's own AI tool does all the reasoning on their machine (Claude Code, Codex or any command; ADR 0005), and Atlas handles storage, embeddings and vector search. Stash holds no LLM key.

```text
 Laptop 1                         MongoDB Atlas                      Laptop 2
 +------------------+            +------------------+            +------------------+
 | Claude Code      |            | Collections      |            | Any agent        |
 |   | stash push   |            |  Sessions, Events|            |   ^ stash pull   |
 | stash CLI        |            |  Memories, Merges|            | stash CLI        |
 |  capture, redact |            |  Guardrails      |            |  prints Briefing |
 |  your AI tool:   |            | Auto Embedding   |            |   ^              |
 |  Digest, Memories|   store    | Vector Search    |    read    |                  |
 | Next.js (local)  | ---------> |                  | ---------> | Next.js (local)  |
 |  validate, store |            +------------------+            |  fixed template  |
 +------------------+                                            +------------------+
```

The CLI redacts on the laptop, then runs the developer's own AI tool on the redacted Transcript at push or merge time. The local Next.js only validates, stores and searches. Pull only reads from Atlas, so the second agent receives the first agent's context through the shared database.

```text
stash/
├── apps/
│   ├── cli/              # npm CLI: capture, redact, run the local AI tool, push, pull, merge
│   └── web/              # Next.js: website + API (storage, validation, Vector Search)
├── packages/
│   ├── core/             # shared business logic
│   ├── context-format/   # Universal Context Format types
│   ├── agent-adapters/   # reading sessions: Claude Code first
│   └── llm-adapters/     # running the developer's AI tool: Claude Code, Codex, any command
└── package.json
```

| Component | Technology | Notes |
| --- | --- | --- |
| CLI | Node.js / TypeScript, npm | Capture, redaction and batching all happen locally |
| Website + API | Next.js (TypeScript) | One app. Validates, stores and searches; never calls an LLM. |
| Reasoning | The developer's own AI tool, run by the CLI: Claude Code (`claude -p`), Codex (`codex exec`) or any command | Model-agnostic. Each Version and Merge records which tool and model did the work (`extractedBy`) |
| Database | MongoDB Atlas | Holds Workspaces, Projects, Sessions, Events, Memories, Merges, Guardrails, pulls |
| Embeddings | Atlas Automated Embedding (`voyage-4`) | No embedding provider or key. Only Memory text is embedded. |
| Retrieval | Atlas Vector Search, filtered by project | Used for merge candidates, Guardrail detection and website search |

**Choosing the tool:** `--llm claude|codex|cmd` for one run; otherwise the agent Stash runs inside; otherwise the saved choice, asked once from the tools installed. Every reply is checked against the same zod schema, with one retry.

**What changed from the blueprint and why:**

- Python FastAPI and a separate React app became one Next.js app, so we maintain one language and define schemas once.
- Server-side Anthropic was planned, then replaced by local reasoning through the developer's own AI tool (round 5): no key to hand over, and any LLM works.
- OpenAI `text-embedding-3-small` was proposed and then replaced by Atlas Automated Embedding (generally available since August 2026). That removes an API key and the embedding-migration planning, and it's the most MongoDB-native option.

### Credentials

| Credential | Where it lives |
| --- | --- |
| Stash token | Developer's machine (CLI config) |
| AI tool login | The developer's own (Claude Code, Codex, …). Stash never sees it |
| Atlas connection string | Backend environment |
| Approver secret | Typed by the human into the website and held only in that browser tab. The server stores only a hash. |

Developers need a Stash token and the AI tool they already use. Stash never holds an LLM key and never pays for LLM use; reasoning counts against the developer's own plan.

### Two-laptop demo topology

Each laptop runs the CLI and its own local Next.js (website and API, with only the Atlas connection string). Both connect to the same Atlas cluster, so they share Projects, Sessions and Memories. Vercel isn't used for the demo, which avoids its request-size and run-time limits. In short: two local apps, one shared cloud database.

### Atlas setup (the hackathon Sandbox)

Stash must be built in the hackathon's Atlas Sandbox: the **Agents in Context Toronto** organisation, in your Sandbox project. That is a hard rule of the event.

| Setting | Value |
| --- | --- |
| Cluster | `Cluster0`, tier **M10** (dedicated), MongoDB 9.0.7, AWS, one region, backups on |
| Storage auto-scaling | **Must be on.** Automated Embedding on M10+ needs it; if the disk fills, embedding pauses and the index goes stale |
| Embedding model | `voyage-4` (MongoDB's recommended general model), set in the index |
| Embedding cost | 200 million free tokens per model per organisation, one-time |
| Embedding rate limits | Dedicated clusters get the paid limits: 2,000 queries and 2,000 index updates a minute. The 3-a-minute limit only applies to free M0 clusters without a payment method |
| Network access | Add each demo laptop's IP (or the venue's) under Database and Network Access, or the backends cannot connect |
| Database user | One user for the backend; its connection string goes in each laptop's `apps/web/.env` |

### Vector Search: one index, used everywhere

One Vector Search index on the `memories` collection does all of Stash's semantic work:

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

Queries pass plain text (`"query": "<text>"`) and Atlas embeds it with the same model. Every query is filtered to the Project, and to current Memories.

| Where | What it asks Vector Search |
| --- | --- |
| Merge | For each Memory in Session A, the nearest Memories in Session B: the candidates for Duplicate, Complementary or Conflicting |
| Guardrails | For each new Failed Approach, the nearest Failed Approaches in the Project's other Sessions: a repeat across 2+ Sessions triggers a proposal |
| Website search | The Memories nearest a question, filtered by type and status |
| Pull | The Memories from other Sessions nearest the pulled objective, added to every Briefing as "Related from other Sessions". Still no LLM at pull time (ADR 0002) |

## 7. CLI

The MVP CLI has eight commands. Merge is essential, not a stretch goal, and Guardrails are read-only from the CLI.

| Command | What it does |
| --- | --- |
| `stash login` | Stores a Stash token |
| `stash init` | Creates or joins the Project from the normalized git remote URL. With no remote, asks for a Project name. Never creates one Project per machine. |
| `stash push` | Capture → redact → upload → Digest and Memories → Guardrail check, with progress shown |
| `stash pull <session-or-merge-id>` | Prints a Briefing. `--budget <tokens>` (default about 6,000), `--output STASH.md` to also write a file |
| `stash merge <session-a> <session-b>` | Builds a Merge while you wait, with progress, and prints its ID |
| `stash sessions` | Lists the Project's Sessions |
| `stash status` | Connection, Project and sync status |
| `stash guardrails` | Lists Guardrails and their status. Read-only. |

**Deferred:** `pull --project`, `search` (the website covers it), `memory`, `logout`, `config`.

**Never added:** `stash guardrails approve` or `reject`. An agent with a shell could run them on itself (ADR 0004).

Example push output:

```text
$ stash push

✓ Capturing session
✓ Scanning transcript for secrets
✓ 3 secrets redacted
✓ Uploading transcript (148 events)
✓ Generating Digest
✓ Extracting Memories (12 found)
✓ Checking for repeated failures

Push completed successfully.
Session: ses_8kq2v
Version: 2
```

Pushing again with no changes:

```text
$ stash push

Session: ses_8kq2v
Events: 230
No changes detected. Already up to date (v2).
```

## 8. Push pipeline

A push goes through eight steps. Everything sensitive happens on the laptop. Everything that needs an LLM runs through the developer's own AI tool, and the CLI shows progress throughout.

1. **Find the session.**
   - Inside Claude Code, read `CLAUDE_CODE_SESSION_ID` (with `CLAUDECODE=1` identifying the agent). This is the preferred path and the most reliable.
   - From a separate terminal, list the local sessions for this folder and ask the user to pick one if more than one matches.
   - `--session <id>` overrides both.
   - Never silently push the wrong session. If identification isn't reliable, ask.
2. **Parse** the Claude Code JSONL from `~/.claude/projects/<folder>/<session>.jsonl`.
   - Keep only the branch the session ended on.
   - Each rewind becomes an Event noting that a branch was abandoned; the abandoned branch itself isn't captured.
3. **Normalize and filter** into the Universal Context Format.
   - Keep: user and assistant messages, tool calls, relevant tool results, file reads and changes, errors, command output, metadata, timestamps.
   - Drop: thinking blocks (hidden reasoning isn't portable), Claude Code's roughly 15 internal record types, duplicate output.
   - Large outputs: keep useful excerpts (error messages, relevant snippets) plus a reference to what was left out, never whole file dumps.
4. **Redact locally, before batching.** See section 14. Nothing secret ever reaches Atlas.
5. **Upload in batches.** Event IDs are stable, so a retried batch never duplicates. If nothing changed, stop with "Already up to date (vN)" and create no new Version.
6. **Process locally with the developer's AI tool.**
   - Build a new Digest from the *whole* Transcript.
   - Extract a complete new Memory set for this Version, checked against the schema (one retry), then uploaded.
   - The server re-checks every citation and rejects Memories citing Events that aren't in the Session.
   - Mark the Version processed. Its Memories become the Session's current set, and earlier Versions stay stored and unchanged.
7. **Record lineage** from any `stash:briefing` markers in the Transcript (section 13).
8. **Guardrail check** against other Sessions' Failed Approaches (section 12).

**Why push waits for extraction:** the user gets confirmation that their context is ready before switching to the other laptop, and the progress lines make the demo easy to follow.

## 9. Memories

A Memory is an interpretation backed by cited Events. It has one of five types and one of three stored statuses, and it belongs to exactly one Session Version.

### Events vs Memories (the core rule)

Events are immutable records of what observably happened. Memories are what an LLM concluded from them. Never store an LLM interpretation as an Event.

| Event (observation) | Memory (interpretation) |
| --- | --- |
| Database query returned a timeout | Database latency may be contributing to the login failure (Hypothesis) |
| `npm test` returned 3 failures | Token refresh has a race condition (Evidenced, cites the test output) |
| API returned HTTP 429 | Frequent requests hit the API's rate limit |

Even when an agent states a decision outright, the message is the Event and the Decision is a Memory pointing to it.

### Five Memory Types

| Type | Represents | Example |
| --- | --- | --- |
| Decision | A choice made, and why | Investigate token refresh synchronization |
| Discovery | Something learned about the code, system or environment | The project contains generated files overwritten during builds |
| Failed Approach | Something tried that didn't work, and why | Raising the DB timeout didn't fix the failures |
| Constraint | A known limitation or requirement | The project must support Node 22 |
| Open Question | Something unresolved | Does the API support batch requests? |

**Removed from the vision:** *Lesson* is now what a Guardrail is for, and *Architecture* folds into Discovery. *Guardrail* is its own entity, not a Memory type. **Memories describe and never instruct.** A Memory worded as an instruction would reach agents without approval.

### Memory Status

| Status | Meaning | Who sets it |
| --- | --- | --- |
| Hypothesis | Inferred; no Event directly shows it | LLM |
| Evidenced | A cited Event directly shows it (a test output, a tool result) | LLM |
| Verified | A human confirmed it on the website | Human only, with the approver secret |

There are no numeric confidence scores, because LLM confidence numbers are noise. "Disputed" is never stored on a Memory. A conflict lives in a Merge as a Conflicting Finding (ADR 0003).

### Versions and ownership

- Every Session Version gets its own Digest and its own complete Memory set, extracted from the full Transcript.
- The latest processed Version's Memories are the Session's **current** Memories. Earlier Versions' Memories stay stored for history.
- A change of mind shows up in the new Version. It isn't reconciled against outdated Memories, and there's no cross-Version reconciliation system.
- Pushing identical content twice does nothing, so there's no duplicate extraction or embedding cost.

### Duplicates across Sessions

Sessions A and B discovering the same race condition produce **two Memories, each with its own owner**. Nothing is combined across the Project when storing. Duplicates are collapsed in Merges, in Briefings and in search results, and their sources are kept. This avoids write conflicts between concurrent pushes.

### Embedding

Only Memory text is embedded, automatically by Atlas. Transcripts, Digests and Events are stored but not embedded, because embedding whole transcripts adds noise.

## 10. Pull and Briefings

A Briefing is rendered from stored data by a fixed template, with **no LLM call at pull time** (ADR 0002). It also runs one Vector Search query to bring in related Memories from other Sessions. That keeps pull fast and free, and identical for every agent pulling the same Version while the Project's memory is unchanged.

### Delivery

`stash pull <id>` prints Markdown to the terminal. Any agent with a shell can run it and read the result, so it works with any provider. `--output STASH.md` writes the same Briefing to a file. MCP delivery is a stretch goal, and native session restore is out of scope.

### Section order

1. Marker line: `stash:briefing <id>@v<version> pull=<pull-id>`
2. Approved Guardrails
3. Objective and current progress
4. Decisions
5. Discoveries
6. Failed Approaches
7. Constraints
8. Open Questions and next steps
9. Related from other Sessions
10. Key evidence excerpts, with Event IDs

Every Memory is shown with its status, so an agent never mistakes an inference for a fact. A Briefing from a Merge shows its conflicts as Conflicting Findings.

### Related from other Sessions (Vector Search)

One `$vectorSearch` on the `memories` index, run at every pull:

- **Query:** the pulled Session's (or Merge's) objective, as plain text. Atlas embeds it with `voyage-4`.
- **Filter:** the same Project, current Memories only, and never the pulled source itself.
- **Result:** the 8 nearest Memories, duplicate texts removed, Failed Approaches first so the next agent sees what others already ruled out. Each shows its status and the Session it came from.
- **Record:** the pull stores which Memories it included.

Example: pulling the auth investigation brings in "The cache serves a session after it expires" (hypothesis, from the cache investigation) and "Raising the db timeout changed nothing" (evidenced, from an earlier session), even though neither was in the session being pulled.

### Token budget

The default is about 6,000 tokens, set with `--budget`, e.g. `stash pull ses_A --budget 10000` or `stash pull m_789 --budget 4000`. When content must be dropped to fit, Stash drops the least important items first. Related Memories from other Sessions go before the Session's own. Approved Guardrails are never dropped, and the end is never simply cut off.

### Why not an LLM at pull time

It would be slow on stage, cost money on every pull, and give different output each time. All LLM work happens during `push` and `merge`. If Briefings need to be better, the fix is better extraction at push time.

### What a Briefing is built from

The Digest of the Session Version (or Merge), its current Memories, related Memories from other Sessions found by Vector Search, a few key Events as evidence, and the Project's approved Guardrails. A Session's Briefing never includes another Merge's dispute, because pulling Session A alone always gives the same result.

## 11. Merge

A Merge reconciles exactly two Sessions into one Digest plus Findings. It never changes after it's created, and it never changes its sources (ADR 0003).

### Rules

- **Inputs:** exactly two Sessions in the MVP. It uses each one's latest processed Version and records both Session IDs and Version IDs. A Merge can't be used as a source for another Merge.
- **Where it runs:** `stash merge <a> <b>` from the CLI, while you wait, with progress shown. The website only displays Merges.
- **Process:** compare the two Digests, Memories and supporting Events. The server uses Vector Search to find related items, then the developer's AI tool judges them against the original evidence (quality, tool outputs, timestamps, status, whether the code changed in between). The conclusion that appears most often doesn't win by default.
- **Immutable:** if a source gets a newer Version, the old Merge stays tied to the old Versions. A new Merge must be created.
- **Pullable:** `stash pull m_789` builds a Briefing from the Merge's Digest, Findings, evidence and approved Guardrails.

### Finding types

| Type | Meaning |
| --- | --- |
| Duplicate | Both Sessions found the same thing |
| Complementary | Different but related things |
| Conflicting | Incompatible conclusions. This is what "disputed" means. |
| Only in one source | Found in one Session but not the other |

Every Finding cites its Memories and Events.

### Disputes stay in the Merge

| Object | Status |
| --- | --- |
| Session A → Memory X | Evidenced (unchanged) |
| Session B → Memory Y | Evidenced (unchanged) |
| Merge M1 → Finding X vs Y | Conflicting |

`stash pull A` shows X as Evidenced. `stash pull M1` shows X and Y as a conflict. When the website shows a Memory, it can look up "Disputed in Merge m\_12".

### Example output

```text
$ stash merge ses_A ses_B

Analyzing session histories...
Finding related discoveries...
Checking conflicting conclusions...
Reconciling evidence...

Merge completed.
Combined findings: 14
Duplicate discoveries: 3
Conflicting conclusions: 2
Failed approaches preserved: 5

Merge: m_789
```

**Demo case:** Agent A investigates auth, finds a token-refresh race and rules out the database. Agent B investigates the database, finds a stale cache and rules out auth. The Merge shows both findings, the evidence for each, and the unresolved disagreement. The result is more complete than either Session alone.

## 12. Guardrails

A Guardrail is proposed only when the same failure appears in two or more different Sessions. It reaches agents only after a human approves it on the website with the approver secret.

### Memory vs Guardrail

A Memory describes something Stash learned. A Guardrail is a rule that changes what future agents do.

- **Memory (Discovery):** "The project contains generated files that are overwritten during builds." Retrieved automatically.
- **Proposed Guardrail:** "Do not edit generated files directly. Modify their source definitions instead." Inactive until a human approves it.

### Proposal trigger (runs after every successful push)

1. Take the new Session's Failed Approach Memories.
2. Use Vector Search to find similar Failed Approaches in the Project's other Sessions.
3. The developer's AI tool, run by the CLI, compares the underlying evidence to decide whether it's really the same failure. Similar wording alone never triggers one.
4. The failure must appear in at least 2 different Sessions. Two failures within one Session don't count.
5. Skip it if an existing Guardrail (proposed, approved or rejected) already covers the pattern.
6. Otherwise the AI tool drafts a Proposed Guardrail citing the supporting Memories and Events.

### Lifecycle

Repeated failure → **Proposed** → **Approved** (included in every Briefing for the Project) or **Rejected** (never proposed again for that pattern).

### Who can do what

| Action | Where |
| --- | --- |
| Propose | The CLI after a push (AI tool checks the evidence); the server verifies it spans 2+ Sessions |
| View | Website and CLI (`stash guardrails`) |
| Approve or reject | Website only, with the approver secret |
| Apply | Automatically, in Briefings |

### MVP constraints

Guardrails apply within one Project, have no expiry or versioning in the MVP, and always need human approval. The vision's separate "security policies" layer is deferred, but the principle stands: agents can never weaken controls or approve their own instructions.

### Example Guardrails from the vision

- Generated files: "Do not directly modify generated files. Update the source schema and regenerate."
- API rate limits: "Use request throttling and exponential backoff for this API."
- Conventions: "Use the existing repository abstraction for database queries."

## 13. Session Lineage

Every Briefing starts with a marker line. When the receiving Session is pushed, Stash finds that marker in its own Transcript and records which Session or Merge, at which Version, it continued from.

```text
stash:briefing ses_A@v2 pull=p_91
```

### How it works across two laptops

1. Laptop 1: Claude Code works, then pushes `ses_A`.
2. Laptop 2: an agent runs `stash pull ses_A`. The Briefing, marker included, becomes a tool result in that agent's Transcript.
3. The agent continues working, and its session becomes `ses_B`.
4. `ses_B` is pushed. Stash finds the marker and records that `ses_B` continued from `ses_A` at v2.

### Why a marker

- **Works with any agent.** The first idea was to record the parent at pull time using Claude Code's `CLAUDE_CODE_SESSION_ID`, but other agents may not expose a session ID. Any agent that runs `stash pull` through its shell captures the marker.
- **Explicit, never guessed.** Lineage is never worked out from similar wording or timestamps.
- **Several parents for free.** A Session that pulled twice has two markers and two parent links.

### Data shape (illustrative)

```ts
interface SessionLineage {
  sessionId: string;
  parentSessionId: string;
  sourceType: "session" | "merge";
  sourceVersionId: string;
  pullId: string;
  createdAt: Date;
}
```

On the website the Session page shows the chain, e.g. ses\_A (Claude Code, laptop 1, original) → Briefing v2 transferred → ses\_B (laptop 2, continued from ses\_A).

## 14. Security, secrets and the approval boundary

Secrets are removed on the laptop before anything is uploaded. Approvals need a secret that only a human holds.

### Secret redaction

1. The CLI parses the local Transcript.
2. It scans messages, tool arguments, tool outputs and file contents for known formats: Anthropic, OpenAI, AWS and GitHub keys, Atlas connection strings, JWTs.
3. It reads local `.env` files and matches their values anywhere in the Transcript.
4. Each match becomes a typed placeholder, e.g. `ANTHROPIC_API_KEY=[REDACTED:anthropic]`.
5. Only the sanitized Transcript is uploaded.

Rules:

- Redact before batching.
- Count *distinct* secrets, so the same key seen five times counts once.
- Never put original values in logs.
- If scanning fails, upload nothing.
- Excluded or oversized content keeps a reference, so you can see what was left out.

### Authentication (MVP)

One Workspace, created by a seed script. `stash login` stores a Stash token. `stash init` creates or joins the Project from the git remote. The website has no login for the demo. Okta/Auth0 is the stretch goal: it would add user accounts, Workspace membership, Project-level access and proper token issuance.

### The approval boundary (ADR 0004)

An agent has a shell and the Stash token, so anything the CLI can do, an agent can do. That's why:

- The CLI is read-only for Guardrails and Memory Status.
- Approve, reject and Verify require the **approver secret**. The human types it into the website, the browser holds it in tab memory only, and the server stores a hash and checks it on every such request.
- The secret is never stored in a `.env` file, which agents read routinely. It's never attached by the website server either, because an agent could `curl` that route.
- Hiding buttons is not what enforces this. The server checks the secret.

**Honest limitation:** in the two-laptop demo each backend runs locally with the Atlas credentials, so a determined agent could write to the database directly. That's acceptable for the hackathon. In production the backend is hosted and agents never see its environment. Say this plainly in the pitch.

## 15. Website and landing page

The web app has two parts: a public landing page that people arrive at, and the five-page app a user sees once set up. The landing page design is settled on page 15, "Bubbles", in `design/landing/15-bubbles/`.

### The landing page today

- **Look:** the Vantage theme. A blue-black ground, Geologica type, one lime signal colour, hairline frames with corner ticks.
- **Hero:** big, dull bubbles of ASCII characters arranged like a flower (six equal bubbles evenly spaced around the middle) fill the right of the first screen and fade out behind the headline on the left. The six outer bubbles are agents; the middle one is Stash. No text sits on the art.
- **Headline:** "Your agents forget. Stash remembers." with "Shared memory for AI coding agents, across sessions, models and teammates."
- **Cursor:** the bubbles tilt slightly toward the pointer. A lime brush trail was tried and removed.
- **Sections:** the problem ("Every new session starts from zero"), how it works as four large rows (push, pull, merge, learn), "Git shares code. Stash shares the context behind it." with a handoff.md vs Stash table, and the install band ("Never write a handoff.md again." with the install command). A row of three platform cards was tried there and removed.
- **Docs:** this page, linked from the nav, for private reading until launch.

### The hero loop, and what it means

The animation is the product's cycle, told without words. It never ends, and it always returns to the start:

1. **Agents learn and push.** Grey agent bubbles send pulses across the gap to the middle, each on its own timer. Every pulse that lands makes the middle a step brighter (never bigger).
2. **Stash fills.** When the middle is full, it holds for a moment.
3. **Stash briefs every agent.** The middle sends a pulse out to each agent; each one turns green gradually over about three seconds as it takes in the Briefing, and the middle dims.
4. **Agents use the context.** The green drains away as each agent works with what it received, until it is grey again.
5. **Back to step 1.** A grey agent starts pushing what it has learned since.

### How the design got here (decision log)

| Round | What was shown | Feedback | Outcome |
| --- | --- | --- | --- |
| 1 | Five directions: Terminal, Cobalt, Lumen, Console, Vantage | "Vantage is definitely the best" | Vantage theme kept |
| 2 | Five Vantage variations (search, push, pull, merge, guardrails) | Art unclear; what does it represent, what does the cursor do | Art must stand for the product |
| 3 | ASCII flower: petals are agents, center is Stash | Liked the idea; flat; random white flashes; too much explanation on the hero | 3D, one unified animation, quiet hero |
| 4 | Lit 3D flower with an Apple-style pinned scroll story | Looked like eggs; center did not fill; text moved on scroll | Petals, a center that fills, fixed text |
| 5 | Pointed petals, spiral seed head, fixed swapping text | Looked like blades; pulses should be staggered; dropped the Apple layout | Rounded petals, staggered pulses, original layout |
| 6 | Rounded petals plus a laptops-and-cloud explainer | Animation ended; build slower; brighter not bigger; no second animation; no pause button | Full redesign |
| 7 | Big dull bubbles arranged like a flower (page 15) | Glyphs misaligned; add a cursor trail; green should not stay forever; add these docs | Aligned grid, brush trail, meaningful loop, docs page |
| 8 | Page 15 with the brush trail and platform cards | Remove the brush; remove the platform cards | Both removed |
| 9 | Page 15 without them | Bubbles not symmetric; turning green too fast | Six equal bubbles evenly spaced on one ring; green fills over three seconds |
| 10 | Symmetric ring | Let them move a little and come back, smoothly; more characters, not brighter | Each bubble drifts slowly around its home; a finer character grid with proportionally more points |

### App pages (MVP)

| Page | Shows |
| --- | --- |
| Home | Counts and recent activity (cut first if behind) |
| Sessions | List, plus a detail page: Digest with evidence linked to Transcript Events, and the lineage chain |
| Memories | Vector search, a status filter, and a Verify button (approver secret) |
| Merges | The two sources side by side, with Findings coloured by type |
| Guardrails | Proposed and Approved Guardrails with their evidence, and approve/reject buttons (approver secret) |

The website never takes uploads: the CLI handles capture. Workspace and access management, invites and audit views are deferred.

## 16. Demo repo and demo script

The demo runs on real Claude Code sessions against a small TypeScript API with planted problems. The quality of those sessions decides how convincing Merge and Guardrails look.

### Demo repo (on GitHub, cloned on both laptops)

1. **Intermittent login failure with two plausible causes:** a race condition in token refresh, and a stale cache. Each must be testable on its own, so agents can gather evidence for or against each one. Session A finds the race, Session B finds the cache, and the Merge reconciles them.
2. **Generated API client** built from a source schema. Agents edit it directly, then the build overwrites the edit or a check fails. When this happens in two or more Sessions, Stash proposes "don't edit generated files".
3. **A fake API key in `.env`** that an agent reads, so the push shows a secret being redacted.

Both laptops clone the same remote so they resolve to the same Project.

### Demo script

1. **Laptop 1:** Claude Code investigates the login bug, finds the token-refresh race, and runs `stash push`. The output shows events captured, 1 secret redacted, Memories extracted.
2. **Laptop 2:** a different agent runs `stash pull ses_A` and continues without re-investigating (context across sessions and LLMs).
3. **Merge:** `stash merge ses_A ses_B` on the two independent investigations. The Merges page shows the Duplicate, Complementary and Conflicting Findings with their evidence.
4. **Guardrails:** the Guardrails page shows the Proposed Guardrail built from repeated edits to the generated file. A human approves it with the approver secret, and the next `stash pull` includes it (adapting its own guardrails).
5. **Lineage:** the Sessions page shows ses\_B continued from ses\_A.
6. **Reliability:** run `stash push` again, get "Already up to date", then click any Memory back to its source Event.

Every Session is a real Claude Code session; none are faked.

## 17. Build order, cut order and stretch goals

Push, pull, merge and Guardrails are never cut, because they are the pitch. The landing page is designed first, ahead of the build order below.

### Build order

0. **Landing page:** five directions, you pick one, then build it.
1. Atlas cluster, auto-embed Vector Search index, seed script (Workspace, token, approver secret hash)
2. Demo repo with the planted problems, pushed to GitHub
3. Claude adapter, redaction, and push storing raw Events
4. Digest and Memory extraction
5. Pull and Briefing
6. Merge
7. Guardrail proposal
8. Website app, starting with the Guardrails and Merges pages
9. Lineage
10. Record real sessions
11. Rehearse twice

### Cut order if behind

1. Home page
2. `stash sessions` and `stash status`
3. The website's lineage chain (keep the data)
4. The Verify button

### Stretch goals

- Okta/Auth0 login
- An MCP server (`stash_pull`, `stash_search` tools)
- A Codex push adapter (there are 3 old Codex sessions on this machine)
- Auto-push from a Claude Code hook when a session ends
- `stash pull ... --output` wired into CLAUDE.md or AGENTS.md

## 18. Decision log

This records every question from the design sessions (2026-11-11 to 11-13) and its final answer. Where you changed my recommendation, the final column says so.

### Before the grilling

| Topic | What happened | Final |
| --- | --- | --- |
| Project direction | I pitched a different concept. You declined. | You set the direction; Stash is your blueprint. |
| Blueprint | You supplied the full blueprint | Saved as BLUEPRINT.md, formatted with your wording unchanged |
| Scope | You noted the blueprint is too big for 24 hours | MVP of six features (section 4) |

### Round 1: foundations and core terms

| # | Question | Final decision |
| --- | --- | --- |
| 1 | Stack for a 24-hour build | TypeScript everywhere: npm CLI plus one Next.js app (website and API). No Python. *(Your call; the blueprint said FastAPI.)* |
| 2 | LLM and embeddings | One LLM provider (Anthropic Claude Sonnet) for every operation, behind a thin interface *(superseded in round 5: the developer's own AI tool)*. Embeddings were first OpenAI `text-embedding-3-small`, later replaced (round 2). |
| 3 | Second agent for the cross-LLM demo | Not a concern for now |
| 4 | Session identity and re-push | One Session per native session. Each push with new Events is a new Version. An identical push does nothing ("Already up to date"). |
| 5 | Events vs interpretations | Events are observations only and never change. Decisions, discoveries and failures are Memories citing Events. |
| 6 | Is a Guardrail a Memory? | No. A Guardrail is its own governed entity with its own collection. Memories are retrieved automatically; Guardrails only after approval. |
| 7 | Overloaded "context" words | Transcript (what happened), Digest (what was learned), Briefing (what the next agent receives). Drop "context package" and "unified context". |
| 8 | Project vs Workspace | **Both exist** *(you changed my recommendation of Project only)*. Workspace owns Projects. A Project is the repo, matched by its normalized git remote, never one per clone. |
| 9 | How push finds the session | Inside the agent is preferred (environment variable). A separate terminal is also supported, asking the user to choose when there's more than one candidate. Never silently upload the wrong session. |
| 10 | How pull delivers | Markdown to stdout, plus `--output STASH.md`. MCP later. |
| 11 | What's captured, and where redaction happens | Keep messages, tool calls and results, file changes, errors and metadata. Drop thinking blocks and internal records. Keep useful excerpts of large outputs with a reference to the rest. Redact locally before upload. |

### Round 2: keys, memory, extraction, auth, demo

| # | Question | Final decision |
| --- | --- | --- |
| 1 | Where keys live | Server-side. Developers need only a Stash token. *(Superseded in round 5: no LLM key at all.)* |
| 2 | Where it runs for the demo | **Two laptops**, each running Next.js locally, one shared Atlas *(you extended it to two laptops)*. No Vercel. |
| 3 | When extraction runs | During push, with progress shown. *(You pushed back on "replace old Memories"; settled in round 3.)* |
| 4 | Memory types | Five: Decision, Discovery, Failed Approach, Constraint, Open Question. No Lesson or Architecture. Memories never instruct. |
| 5 | Confidence | One status field instead of numeric scores. LLM sets Hypothesis or Evidenced; only a human sets Verified. ("Disputed" moved to Merges in round 3.) |
| 6 | Duplicate Memories across Sessions | Two Memories with two owners. Duplicates are handled at Merge, in Briefings and in search, never when storing. |
| 7 | Auth | Seeded Workspace, token-based CLI login, no website login. Okta/Auth0 is the stretch goal. |
| 8 | `pull --project` and search | Both deferred. Search lives on the website. Approved Guardrails go into every Briefing. |
| 9 | Who approves Guardrails | Only a human, on the website. The CLI is read-only. |
| 10 | Demo repo | A TypeScript API with a two-cause login bug and a generated client. Real sessions. Build it first. |
| none | Embedding provider (follow-up) | Atlas Automated Embedding replaces OpenAI. No embedding key. |

### Round 3: conflicts, merge, lineage, guardrails

| # | Question | Final decision |
| --- | --- | --- |
| 1 | Atlas vs OpenAI key | Atlas Automated Embedding. The backend holds the Atlas connection string (the Anthropic key was dropped in round 5). Only Memory text is embedded. |
| 2 | Can a Merge mark source Memories Disputed? | No. A dispute is a Conflicting Finding inside the Merge. Sources never change. |
| 3 | Re-push reconciliation | **Each Version extracts a full new Memory set. The latest Version's Memories are current, and old ones are kept.** No cross-Version reconciliation and no "Superseded" status. *(Your call over my reconcile proposal.)* |
| 4 | `merge` missing from the CLI list | Restored. Essential MVP command. |
| 5 | What a Merge contains | Two Sessions, latest Versions recorded, Digest plus four Finding types, immutable, pullable, can't be merged again |
| 6 | Lineage across laptops | Yes: Session Lineage records the exact source and Version. Explicit, never inferred. Several parents later. |
| 7 | When a Guardrail is proposed | After each push: vector candidates, then LLM checks the evidence, then 2 or more different Sessions, then no existing coverage, then draft. Rejected patterns never return. No expiry or versioning. |
| 8 | How a Briefing is built | Fixed template, no LLM at pull, fixed section order, about 6,000 token default, drop by priority rather than cutting the end |
| 9 | Secret redaction | Local, by known formats plus `.env` values, typed placeholders, distinct count, fail safe |
| 10 | Website pages | Not answered in round 3, settled in round 4 |
| 11 | Approval hole (open endpoint) | Separate approver credential from the agent token, checked by the server. *(Your first answer kept it in the website's environment; corrected in round 4.)* |

### Round 4: final gaps

| # | Question | Final decision |
| --- | --- | --- |
| 1 | Where the approver secret lives | Typed by the human into the website and held in tab memory. The server stores a hash. Never in an `.env` file. |
| 2 | Website pages | Home, Sessions, Memories, Merges, Guardrails |
| 3 | Lineage for any agent | A `stash:briefing` marker in every Briefing, parsed on push. Several parents from day one. |
| 4 | Atlas tier | Add a payment method for paid-tier embedding rate limits. Check the exact limits during setup. |
| 5 | Rewound branches | Capture the branch the session ended on, plus an Event noting each abandoned branch |
| 6 | Project identity in the demo | The demo repo is on GitHub, cloned on both laptops. With no remote, `stash init` asks for a name. |
| 7 | Build and cut order | As in section 17 |
| 8 | Decision records | Write ADRs 0002, 0003 and 0004 |

### After the grilling

| Topic | Final |
| --- | --- |
| Next step | Landing page first, with five design directions to approve or reject. Atlas setup waits. |
| One place for everything | This doc |
| Atlas | Must be built in the hackathon Sandbox: Cluster0, M10, MongoDB 9.0.7; storage auto-scaling on for Automated Embedding |
| Vector Search at pull | Yes: every Briefing adds the nearest Memories from other Sessions; still no LLM at pull |

### Round 5: no LLM key

| Topic | Final |
| --- | --- |
| Anthropic key | Not given. Reasoning runs locally, on the user's machine |
| Which LLM | Whatever the developer uses: Claude Code, Codex, or any command. Hackathon ships those three adapters; Gemini CLI later (ADR 0005) |

## 19. Architecture decision records

Five decisions are written up in `docs/adr/` because a future contributor would likely reverse them by mistake.

| ADR | Decision | Why it's written down |
| --- | --- | --- |
| 0001 | TypeScript everywhere: npm CLI plus one Next.js app for the website and API, with shared packages | Departs from the blueprint's Python FastAPI plus React. One language, schemas defined once, hackathon time spent on product, not glue. |
| 0002 | Briefings are a fixed template; no LLM at pull time (one Vector Search query is allowed) | Someone will want an LLM to "improve" Briefings. Pull must stay fast, free and repeatable; improve extraction instead. |
| 0003 | Merges never change their sources; disputes live in Findings | Someone will want `disputed` as a Memory Status. Pulling Session A must give the same result whatever Merges used it. |
| 0004 | Only a human holding the approver secret approves Guardrails or verifies Memories | Someone will want a CLI approve command. Agents have a shell and the token, so the CLI must stay read-only and the server must check the secret. |
| 0005 | LLM work runs locally through the developer's own AI tool; Stash holds no LLM key | Someone will want to add a server-side API key "for quality". Stash must work with whatever LLM the developer uses. |

Decisions not given an ADR (easy to reverse or unsurprising) are still recorded in the decision log above.

## 20. Known limitations, open items and environment facts

Three things are still open: the hackathon's rules on pre-event coding, team size, and the landing page direction.

### Known limitations (say these in the pitch)

- Each demo laptop has the Atlas credentials, so a determined agent could get around app-level checks. In production the backend is hosted.
- Only Claude Code sessions can be pushed. Any agent with a shell can pull, and any AI tool can do the reasoning.
- The server trusts extraction results from the CLI, checking only that every cited Event exists. Quality depends on the developer's model, shown on every Version.
- Abandoned branches are recorded only as markers, not captured in full.
- No real login, roles or audit views in the MVP.
- Reasoning counts against the developer's own AI plan and adds a few seconds per call.

### Open items

- [ ] Confirm whether the hackathon allows code written before the event
- [ ] Confirm team size and who owns which part
- [ ] Choose a landing page direction from the five examples
- [ ] In the Sandbox project: turn on storage auto-scaling for Cluster0, add the laptops' IPs, create a database user, and get the connection string
- [ ] Claude Code logged in on laptop 1; Codex or Claude Code on laptop 2 (no API key needed)
- [ ] Check that the terminal CLI sets `CLAUDE_CODE_SESSION_ID` (confirmed only in the desktop app so far)

### Environment facts (checked on this Mac, 2026-11-11)

| Fact | Detail |
| --- | --- |
| Claude Code session files | `~/.claude/projects/<folder>/<uuid>.jsonl`: useful records (user, assistant, tool\_use, tool\_result) mixed with about 15 internal record types, so the adapter must keep an allowed list |
| Session ID available | Claude Code sets `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1` for commands it runs |
| Installed | Node 26, npm 11, Python 3.14, Claude Code 2.1.318 |
| Not installed | Codex CLI and Gemini CLI (3 old Codex session files exist in `~/.codex/sessions`) |

### Sources

- [Now GA: Automated Embedding in Atlas Vector Search](https://www.mongodb.com/products/updates/now-ga-automated-embedding-in-atlas-vector-search/)
- [Automated Embedding docs](https://mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/)
- [Automated Embedding models and rate limits](https://www.mongodb.com/docs/vector-search/crud-embeddings/automated-embedding/models/)
- [Atlas cluster tiers](https://mongodb.com/docs/atlas/cluster-tier)

## Appendix A. The original blueprint

Your blueprint as written, kept verbatim for reference. Where it differs from the sections above, the MVP decisions win.

*Project blueprint*


Stash is shared memory infrastructure for AI agents.

It allows developers to capture, store, retrieve, search, transfer, and merge the working context of AI agents across sessions, machines, developers, projects, and LLM providers.

Today, AI coding agents operate in isolated sessions. When a session ends, much of the context behind the work becomes difficult to access or reuse. A developer might spend hours investigating a problem, reading files, testing solutions, making decisions, and ruling out approaches. Starting a new session often means reconstructing that context manually.

Stash solves this by giving agents a persistent, shared context layer.

Instead of treating every agent session as an isolated interaction, Stash turns sessions into reusable project knowledge.

Developers interact with Stash primarily through a CLI, with a website for browsing, searching, managing, and visualizing stored context.

#### Core capabilities

1. **Context portability:** Move working context between sessions, machines, developers, and different LLMs.
2. **Persistent memory:** Build a searchable knowledge base from accumulated agent sessions.
3. **Intelligent merging:** Combine independent agent histories into a unified context while preserving evidence, disagreements, and provenance.
4. **Adaptive guardrails:** Learn from previous failures and propose project-specific constraints for future agents.
5. **Reliable context infrastructure:** Preserve history, track versions, manage permissions, and retrieve relevant information without overwhelming agents.

Stash is not another chatbot memory feature. It is an infrastructure layer that allows multiple agents to build on each other's work.

---

#### 2. The Problem

AI agents are becoming increasingly capable, but their working context is fragmented.

A developer might use Claude Code to investigate a bug, GPT to review an implementation, and another agent to research an architectural decision.

Each agent operates within its own environment, session history, memory system, and context window.

This creates several problems.

##### 2.1 Isolated sessions

An agent accumulates useful context while working:

- Files it has inspected.
- Commands and tools it has executed.
- Findings and discoveries.
- Decisions and the reasoning behind them.
- Failed approaches.
- Relevant outputs and evidence.
- Outstanding tasks.

When a session ends, that context is not necessarily available to another agent.

Developers often resort to manually writing summaries or copying conversations into new sessions. Like asking their agent to write them a handoff doc.

##### 2.2 Repeated investigations

Without shared historical context, agents repeat work.

An agent might investigate a database issue that another agent already ruled out. Another might retry an approach that previously failed.

This wastes time, tokens, and compute.

##### 2.3 No shared project memory

Individual agents may have their own memory systems, but there is no universal place where the collective knowledge of multiple agents can accumulate.

Important information remains scattered across:

- Local session files.
- Chat histories.
- Markdown handoff documents.
- Project documentation.
- Different AI providers.
- Individual developers' machines.

##### 2.4 Difficult handoffs

A handoff document can summarize what happened, but it often loses important details.

It may omit the original tool outputs, sequence of events, failed experiments, supporting evidence, and relationships between decisions.

A new agent receives a summary rather than access to the underlying history.

##### 2.5 Repeated mistakes

Agents frequently make the same mistakes across different sessions.

They might repeatedly modify generated files, violate project conventions, exceed API rate limits, or use approaches that have already caused problems.

There is no consistent mechanism for turning these experiences into reusable, evidence-backed guardrails.

---

#### 3. The Solution: Stash

Stash creates a persistent shared context layer for AI agents.

It captures accessible agent activity, organizes it into structured context, stores it remotely, and makes it available to other agents.

The fundamental idea:

> Git shares code and code history. Stash shares the context, evidence, decisions, and experiences behind agents' work.

Git allows developers to collaborate on the same codebase. Stash allows their agents to collaborate through shared working context.

##### The three core commands

```bash
stash push
stash pull <session-id>
stash merge <session-a> <session-b>
```

- **Push:** Publish an agent session and its working context to Stash.
- **Pull:** Retrieve another session's context and reconstruct it for the current agent.
- **Merge:** Combine independent agent histories into a unified project context.

These commands form the foundation of the product.

---

#### 4. How Users Interact With Stash

Stash should have two primary interfaces:

1. A CLI for developers working in their terminal.
2. A website for browsing and managing shared context.

The CLI is the primary interface. The website is the visual management layer.

##### 4.1 Installation

Distribute Stash as an npm package initially.

Illustrative installation:

```bash
npm install -g @stash/cli
```

Then:

```bash
stash login
stash init
```

`stash login` authenticates the developer.

`stash init` initializes Stash in the current project and associates it with a shared project workspace.

##### 4.2 Push: Save an agent session

Imagine a developer has spent two hours using Claude Code to investigate a bug.

Claude has inspected files, executed commands, explored possible solutions, ruled out several causes, and identified a likely issue.

Rather than losing that context, the developer runs:

```bash
stash push
```

Stash:

1. Identifies the current agent session.
2. Captures accessible session events.
3. Processes and structures the history.
4. Extracts useful memories.
5. Generates embeddings.
6. Stores the original history and derived knowledge in MongoDB Atlas.
7. Returns a session ID.

Example:

```text
$ stash push

Capturing session...
Extracting decisions and discoveries...
Indexing memories...
Uploading to Stash...

Session successfully saved.

Session ID: session-123
Events captured: 148
Memories extracted: 12
Project: my-project
```

The session is now available to other authorized agents and developers.

##### 4.3 Pull: Continue work in another session

Now imagine the developer opens a new session, potentially using a different LLM.

They run:

```bash
stash pull session-123
```

Stash retrieves the stored context and reconstructs it for the target agent.

The context package includes:

- Original objective.
- Work completed.
- Important discoveries.
- Decisions and their supporting evidence.
- Relevant tool calls and outputs.
- Failed approaches.
- Files and dependencies involved.
- Outstanding questions.
- Recommended next steps.

The new agent receives a structured context package and can continue working without starting from zero.

Stash should also support pulling project-level memory rather than only individual sessions:

```bash
stash pull --project
```

This retrieves relevant accumulated knowledge from the project.

##### 4.4 Merge: Combine multiple agent histories

Imagine two developers are independently investigating a problem.

- Agent A investigates authentication and identifies a race condition.
- Agent B investigates the database and discovers a stale cache.

Both agents have useful information, but neither has the complete picture.

The developer runs:

```bash
stash merge session-123 session-456
```

Stash compares both histories, identifies related findings, retrieves supporting evidence, detects conflicts, and creates a unified context.

Example output:

```text
$ stash merge session-123 session-456

Analyzing session histories...
Finding related discoveries...
Checking conflicting conclusions...
Reconciling evidence...

Merge completed.

Combined findings: 14
Duplicate discoveries: 3
Conflicting conclusions: 2
Failed approaches preserved: 5

Merged context: merge-789
```

The original sessions remain unchanged. The merged context becomes a new artifact linked to both source sessions.

---

#### 5. The Stash Website

The website is the visual interface for the knowledge accumulated by agents.

It should not be necessary to manually upload conversations or transcripts through the website. The CLI handles capture and synchronization.

The website provides visibility and control over everything stored in Stash.

##### Main sections

###### Dashboard

- Projects.
- Recent sessions.
- Number of stored memories.
- Recent merges.
- Agent activity.
- Guardrail activity.

###### Sessions

- Browse agent sessions.
- View session histories.
- Inspect tool calls and results.
- See decisions and discoveries.
- Trace information back to its source.

###### Memory Explorer

- Search across all sessions.
- Ask questions about previous project work.
- Browse decisions, discoveries, constraints, and failed approaches.
- Inspect the evidence behind individual memories.

###### Merge Explorer

- Select multiple sessions.
- View related findings.
- Identify disagreements.
- Review merged context.
- Inspect the original sources.

###### Guardrails

- Review proposed guardrails.
- Approve or reject changes.
- See the sessions that motivated a rule.
- Manage active rules and expiration.

###### Project and Access Management

- Manage projects.
- Invite collaborators.
- Control permissions.
- Review activity and audit history.

The website makes Stash's accumulated knowledge understandable and manageable.

---

#### 6. Cross-LLM Context Portability

Cross-LLM portability is one of Stash's most important differentiators.

Different AI providers maintain different session formats, memory systems, context windows, tool definitions, and interaction patterns.

A session created in Claude Code cannot simply be copied into GPT and expected to resume identically.

Stash solves this by introducing a model-independent representation of agent context.

##### 6.1 Universal Agent Context Format

Stash converts accessible agent histories into a standardized format.

Instead of storing context exclusively in Claude's native format, Stash represents the underlying information independently of any specific model.

The universal format should preserve:

- Messages.
- Tool calls and results.
- File interactions.
- Decisions.
- Discoveries.
- Failed approaches.
- Evidence references.
- Outstanding tasks.
- Project metadata.
- Session lineage.
- Timestamps and provenance.

Example:

```json
{
  "project_id": "project-001",
  "session_id": "session-123",
  "agent": "claude-code",
  "objective": "Investigate authentication failure",
  "completed_work": [
    "Inspected authentication middleware",
    "Reproduced race condition"
  ],
  "decisions": [
    {
      "decision": "Investigate concurrent token refresh",
      "evidence": ["event-014", "event-019"]
    }
  ],
  "failed_approaches": [
    "Database connection configuration ruled out"
  ],
  "open_tasks": [
    "Implement synchronization fix"
  ],
  "source_events": [
    "event-001",
    "event-002",
    "event-003"
  ]
}
```

This is a simplified conceptual representation, not a finalized schema.

##### 6.2 Agent-specific adapters

Stash uses adapters to translate between native agent histories and the universal context format.

For example:

```text
Claude Code Session
        |
        v
Claude Adapter
        |
        v
Universal Context Format
        |
        v
Stash Storage
        |
        v
Universal Context Format
        |
        v
GPT / Codex Adapter
        |
        v
Target Agent Context
```

The same underlying context can be reconstructed for different agents.

###### Example workflow

1. Claude Code investigates and implements a feature.
2. The developer runs `stash push`.
3. Stash stores the session in its universal format.
4. The developer opens Codex or GPT.
5. They run `stash pull session-123`.
6. Stash reconstructs the relevant context for that model.
7. The new agent reviews or continues the work.

This is not a transfer of hidden model reasoning or internal model state. It is the transfer of accessible working history, evidence, decisions, and structured context.

Where native session restoration is supported, Stash can use it. Otherwise, it reconstructs a target-compatible context package.

---

#### 7. Persistent Project Memory

Stash should not only preserve individual sessions. It should continuously build a shared memory of the project.

Every pushed session can contribute useful information to the project's knowledge base.

##### Types of memory

| Memory type | Example |
| --- | --- |
| Decisions | Why PostgreSQL was selected |
| Discoveries | A specific API endpoint causes failures |
| Failed approaches | A caching strategy introduced race conditions |
| Constraints | The project must support Node 22 |
| Architecture | How authentication services interact |
| Lessons | Generated files should not be edited directly |
| Open questions | Whether the API supports batch requests |
| Guardrails | Limit requests to avoid rate limiting |

Each memory should contain:

- A unique ID.
- Project and session references.
- Source event references.
- Memory type.
- Content.
- Confidence.
- Verification status.
- Creation and update timestamps.
- Embedding.
- Provenance.

##### Memory lifecycle

```text
Agent Session
     |
     v
Event Extraction
     |
     v
Memory Extraction
     |
     v
Deduplication and Validation
     |
     v
MongoDB Atlas
     |
     v
Semantic Retrieval
     |
     v
Future Agent Context
```

The system should distinguish between verified findings, hypotheses, and unresolved questions.

A model-generated summary should never silently become an established project fact.

---

#### 8. Intelligent Context Merging

Merging agent histories is more than combining two transcripts.

Stash should understand how the information in different sessions relates to each other.

##### 8.1 Merge pipeline

**Step 1: Extract**

Convert both histories into structured events and memories.

**Step 2: Retrieve related information**

Use MongoDB Vector Search to find semantically related findings, decisions, and evidence.

**Step 3: Compare**

Identify:

- Duplicate discoveries.
- Complementary findings.
- Contradictory conclusions.
- Different approaches to the same problem.
- Repeated failed attempts.

**Step 4: Reconcile**

Use an LLM to evaluate the findings alongside their original evidence.

Consider:

- Evidence quality.
- Original tool outputs.
- Timestamps.
- Verification status.
- Whether the project changed between sessions.

Do not simply select whichever conclusion appears most often.

**Step 5: Generate unified context**

Produce a structured briefing containing:

- Combined objective.
- Confirmed discoveries.
- Important decisions.
- Conflicting conclusions.
- Failed approaches.
- Supporting evidence.
- Unresolved questions.
- Recommended next steps.

**Step 6: Preserve lineage**

The merged artifact references the original sessions and events.

Original histories remain immutable.

##### 8.2 Example

Agent A:

- Investigates authentication.
- Finds a race condition.
- Rules out the database as the cause.

Agent B:

- Investigates database performance.
- Finds a stale cache.
- Rules out authentication as the cause.

Stash should not simply combine the summaries.

It should identify the relationship between the findings, inspect the evidence, and produce a unified investigation that preserves both conclusions and any unresolved disagreement.

The result should give the next agent a more complete understanding of the problem than either original session.

---

#### 9. Adaptive Guardrails

This is a particularly important part of the product because agents should become more reliable as they accumulate experience.

Stash should learn from previous mistakes and use that knowledge to guide future agents.

Instead of treating every session as a fresh start, Stash identifies recurring patterns across sessions.

##### 9.1 How it works

1. **Observe:** Capture failures, rejected actions, repeated mistakes, and successful approaches.
2. **Identify patterns:** Compare events across sessions to identify recurring issues.
3. **Propose a guardrail:** Generate a potential project-specific rule supported by historical evidence.
4. **Validate:** Check the proposed rule against existing policies, project requirements, and security constraints.
5. **Approve:** Require human approval for consequential changes.
6. **Apply:** Inject approved guardrails into future agent context.

##### 9.2 Examples

###### Generated files

An agent repeatedly modifies generated files directly, causing build failures.

Stash proposes:

> "Do not directly modify generated files. Update the source schema and regenerate the files."

###### API rate limits

Multiple sessions encounter API rate limits.

Stash proposes:

> "Use request throttling and exponential backoff for this API."

###### Project conventions

Agents repeatedly use inconsistent database access patterns.

Stash proposes:

> "Use the existing repository abstraction for database queries."

##### 9.3 Guardrail management

Each guardrail should have:

- Rule ID and version.
- Description.
- Supporting evidence.
- Source sessions.
- Scope.
- Approval status.
- Creation date.
- Expiration or review date.
- Audit history.

Security policies must remain separate from learned project preferences.

Agents must never be allowed to autonomously weaken mandatory security controls, grant themselves permissions, or override approved restrictions.

---

#### 10. Reliability and Security

Stash is intended to become infrastructure for real agent workloads. It cannot simply store summaries and hope everything works.

Several requirements need to be considered from the beginning.

##### Versioning and lineage

Every session should have a stable identity and version.

Merges should reference their source sessions and events.

Changes should not silently overwrite historical information.

##### Concurrency

Multiple agents may push context or update project knowledge simultaneously.

Use atomic updates, version checks, and conflict detection.

##### Provenance

Every important memory should be traceable to its original session and supporting events.

Agents should be able to distinguish a direct observation from a generated interpretation.

##### Access control

Project-level permissions should determine which agents and developers can retrieve information.

Retrieval must respect permissions, not just storage access.

##### Secret detection

Before uploading session data, detect and redact sensitive information such as:

- API keys.
- Access tokens.
- Passwords.
- Private credentials.
- Other sensitive environment values.

Provide controls for what can be captured and uploaded.

##### Context budgeting

Do not blindly load entire transcripts into a new agent.

Retrieve the most relevant information, prioritize important memories, and respect the target model's context window.

##### Stale memory detection

A decision made several months ago may no longer apply after major code changes.

Stash should track timestamps and relevant project versions, and flag potentially outdated knowledge.

##### Idempotency and recovery

Repeated uploads should not create duplicate events.

Failed uploads should be recoverable, and ingestion should support retries.

##### Auditability

Track who pushed, pulled, merged, approved guardrails, and accessed shared context.

---

#### 11. Technical Architecture

Stash should be structured around a lightweight CLI, backend processing service, MongoDB Atlas, and a web application.

##### Suggested technology stack

| Component | Technology |
| --- | --- |
| CLI | Node.js / TypeScript |
| Package distribution | npm |
| Backend API | Python / FastAPI |
| Database | MongoDB Atlas |
| Semantic retrieval | MongoDB Vector Search |
| Embeddings | Embedding model provider |
| Context processing | LLM-based extraction and reconciliation |
| Website | React / TypeScript |
| Authentication | Token-based authentication |
| Deployment | Cloud hosting |

The architecture should keep agent integrations separate from the core storage and context-processing logic.

This allows Stash to support additional agents without rewriting the underlying system.

##### 11.3 MongoDB collections

- **projects**: Stores project metadata, ownership, and configuration.
- **sessions**: Stores session metadata, agent type, objective, timestamps, status, and project references.
- **events**: Stores the original accessible session history. Example event types:
  - User message.
  - Assistant response.
  - Tool call.
  - Tool result.
  - File read.
  - File modification.
  - Decision.
  - Discovery.
  - Failed approach.
  - Error.
  - Task completion.
- **memories**: Stores extracted and structured project knowledge, including embeddings and provenance.
- **merges**: Stores merged context artifacts and references to their source sessions.
- **guardrails**: Stores proposed and approved project-specific rules.
- **audit_logs**: Stores access and modification history.

Additional collections, such as branches or project memberships, can be introduced as needed.

##### 11.4 Why MongoDB Atlas?

MongoDB should be fundamental to Stash, not simply an interchangeable database.

Agent histories are naturally heterogeneous.

Different agents produce different event types, tool outputs, metadata, and structures. A flexible document model allows Stash to preserve this information without requiring every agent to use an identical native schema.

MongoDB Atlas supports several important parts of the architecture:

- **Document storage:** Store sessions, events, memories, merges, and guardrails as structured documents.
- **Vector Search:** Search memories and historical context by semantic similarity rather than relying exclusively on exact keywords.
- **Metadata filtering:** Restrict retrieval by project, user, agent, session, memory type, permissions, and timestamps.
- **Scalable storage:** Build a persistent knowledge layer as the number of agents, sessions, and projects increases.
- **Flexible schemas:** Support new agent integrations and event types without redesigning the entire database.

The combination of document storage, semantic retrieval, and metadata filtering makes Atlas a central part of Stash's architecture.

---

#### 12. CLI Design

The CLI should provide a simple interface for the most common workflows.

Initial commands:

```bash
stash login
stash logout
stash init

stash push
stash pull <session-id>
stash pull --project

stash merge <session-a> <session-b>

stash sessions
stash search "<query>"
stash memory
stash guardrails

stash status
stash config
```

##### Command descriptions

| Command | Description |
| --- | --- |
| `stash login` | Authenticate with a Stash account. |
| `stash init` | Initialize Stash in a project and connect it to a workspace. |
| `stash push` | Capture and publish the current accessible agent session. |
| `stash pull` | Retrieve a session and reconstruct its context for the current agent. |
| `stash pull --project` | Retrieve relevant accumulated project knowledge. |
| `stash merge` | Combine multiple session histories into a unified context. |
| `stash sessions` | List previously uploaded sessions. |
| `stash search` | Search historical memories and sessions. |
| `stash memory` | Inspect stored project memories. |
| `stash guardrails` | View active and proposed project guardrails. |
| `stash status` | Check connection, project, and synchronization status. |

---

#### 13. Agent Integrations

Stash should use adapters for each supported agent.

The first integration should be Claude Code.

Claude Code already provides its own session management, local history, and memory features. Stash should complement those capabilities rather than attempt to replace them.

The first integration should:

1. Discover accessible local session history.
2. Parse supported messages and tool events.
3. Normalize the information into the universal context format.
4. Upload it to Stash.
5. Reconstruct a target-compatible context package when pulling.

Future integrations could support:

- OpenAI Codex.
- Claude Code.
- Other coding agents.
- Custom agent frameworks.
- Agents built with LangChain or other orchestration systems.

Agent-specific formats can change, so integrations should be modular and version-aware.

Stash should not depend permanently on one provider's private session-file implementation.

It should also be clear about what each integration can capture. Hidden model reasoning and inaccessible internal state are not part of the portable context.

---

#### 14. How Stash Differs From Existing Memory and Handoff Tools

Stash operates in an area where session continuity, agent memory, and cross-agent handoffs are already being explored.

Its differentiation should not be based on simply saving a session or generating a summary.

Existing coding agents already have session resume, compaction, local history, and project memory capabilities.

A handoff Markdown file can also transfer basic context between agents.

Stash goes further by providing a shared infrastructure layer.

| Capability | Basic handoff document | Individual agent memory | Stash |
| --- | --- | --- | --- |
| Save session summaries | Yes | Sometimes | Yes |
| Preserve accessible event history | Limited | Provider-dependent | Yes |
| Cross-LLM context portability | Manual | Limited | Core feature |
| Shared project memory | Manual | Usually isolated | Yes |
| Search across multiple agents | No | Limited | Yes |
| Merge independent histories | Manual | No | Core feature |
| Preserve evidence and provenance | Limited | Varies | Core feature |
| Learn project-specific guardrails | Manual | Varies | Core feature |
| Shared team context | Manual | Limited | Yes |

The distinction:

> A handoff document tells an agent what happened.
>
> Stash gives agents access to what happened, why it happened, the original evidence, what failed, and what other agents learned.

The goal is not to replace every agent's native memory system. It is to connect them through a persistent shared context layer.

---

#### Last thoughts

100'000 of developers use agents every day. When those sessions end, that data is lost and not used

## Appendix B. Architecture decision records, in full

### ADR 0001: TypeScript everywhere: npm CLI plus a single Next.js app for both website and API
The blueprint (BLUEPRINT.md §11) proposes three applications: a TypeScript CLI, a Python FastAPI backend and a React website. For a 24-hour hackathon, we instead build two TypeScript applications in one monorepo: the npm CLI, and one Next.js app that serves both the website and the API. Shared packages hold the Universal Context Format types, the core logic and the Agent adapters. The point is to spend the hackathon on session portability, merging and memory rather than on maintaining three stacks and keeping their schemas in sync across languages. Python stays out unless a Python-only dependency turns out to matter.

#### Considered Options

- **CLI + FastAPI + React (the blueprint):** rejected for the MVP. It means two languages and the schemas defined twice.
- **CLI + separate TypeScript API + Next.js website:** rejected. A third app adds no value at hackathon scale.

### ADR 0002: Briefings are rendered from a fixed template, with no LLM call at pull time
All LLM work (Digests, Memories, Merge Findings, Proposed Guardrails) happens during `stash push` and `stash merge`, on the developer's machine through their own AI tool (ADR 0005), and the results are stored in Atlas. `stash pull` only reads that structured data, ranks it, fits it to the token budget and renders a fixed-order template. This keeps pulls fast, free and repeatable, which matters both on stage and for agents that pull often. It also means two agents pulling the same Version receive the same Briefing. Don't add an LLM summarisation step at pull time. If Briefings need to be better, improve what gets extracted at push time.

#### Vector Search at pull is allowed

Pull runs one `$vectorSearch` to add related Memories from other Sessions, using the pulled objective as the query. That is a database query, not a model writing text, so this decision holds: no LLM generates anything at pull time. A Briefing for the same Version is identical as long as the Project's memory has not changed; when new Sessions are pushed, the related section can include them, which is the point.

### ADR 0003: Merges never change their sources; disagreements live in Findings
A Merge records the exact Session Versions it compared and never writes to those Sessions or their Memories. When two sources conflict, the conflict becomes a Conflicting Finding inside the Merge. It is not a `disputed` status on the source Memories. So pulling Session A on its own always gives the same result, whatever Merges have since used it, and Merge itself has no concurrency or ordering problems. Don't add `disputed` to Memory Status. To show a dispute next to a Memory, look up the Merges that cite it.

### ADR 0004: Only a human holding the approver secret can approve Guardrails or verify Memories
Agents have a shell and the CLI's Stash token, so anything the CLI can do, an agent can do. The CLI is therefore read-only for Guardrails and Memory Status. Approving or rejecting a Guardrail, and marking a Memory Verified, require an approver secret. The human types it into the website, where it's held only in that browser tab's memory. The server stores only a hash of the secret and checks it on every such request, so hiding buttons in the UI is not what enforces this. Don't add a CLI approve command, and don't put the secret in any `.env` file, because agents read those.

#### Consequences

- The two-laptop demo runs the backend locally, so each laptop has the Atlas credentials, and a determined agent could bypass this check by writing to the database directly. That is accepted for the hackathon. In production the backend is hosted, agents never see its environment, and real login (e.g. Okta/Auth0) replaces the shared secret.

### ADR 0005: LLM work runs locally, through the developer's own AI tool

Stash holds no LLM API key. Every reasoning step (Digest and Memory extraction, Merge Findings, the evidence check behind a Proposed Guardrail) runs on the developer's machine. The CLI calls whichever AI command-line tool the developer already uses, such as Claude Code (`claude -p`), Codex (`codex exec`) or any command that reads a prompt on stdin and prints an answer. The CLI then uploads the structured result. The backend only stores, validates and searches. It needs one secret, the Atlas connection string, and embeddings stay with Atlas Automated Embedding, which needs no key either.

This keeps Stash model-agnostic, which is the product's point: a team using Claude, Codex or a local model gets the same memory. It also removes a credential and a bill from the backend.

#### Considered Options

- **Server-side Anthropic API (the earlier plan):** rejected. It needs a key the user doesn't want to give, and it ties Stash to one provider.
- **Claude Code only (`claude -p`):** rejected. Stash must work with whatever LLM the developer uses.

#### Consequences

- The server trusts extraction results sent by the client. It still rejects any Memory or Finding that cites an Event that doesn't exist in that Session, and Guardrails still need a human (ADR 0004). A modified CLI could upload invented but well-cited Memories; that is accepted for the MVP.
- Quality depends on the developer's model. Each Session Version and Merge records `extractedBy` (tool and model), and the website shows it.
- Pushes and merges count against the developer's own AI plan, and each call adds a few seconds while the tool starts.
- Small models may not fit long Transcripts. The MVP shortens older tool output and warns when a Transcript still doesn't fit; splitting long Sessions into chunks comes later.
- Capturing Sessions is a separate concern: push still reads Claude Code session files only. Any tool can do the reasoning, and any agent can pull.
- Pull stays free of LLM calls (ADR 0002).
