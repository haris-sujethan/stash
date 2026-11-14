# Stash: Hackathon MVP

[BLUEPRINT.md](BLUEPRINT.md) is the long-term vision. This file is what we're actually building in 24 hours. It records every decision from the design sessions. Terms are defined in [GLOSSARY.md](GLOSSARY.md), and the decisions most likely to be reversed by mistake are explained in [docs/adr/](docs/adr/).

The MVP should show the core idea rather than build the whole platform. The demo is one complete workflow with two agents and a shared project.

## MVP features

1. **Session capture:** Claude Code integration that captures accessible session history.
2. **Push to Atlas:** `stash push` stores Events and metadata, extracts a Digest and Memories with the developer's own AI tool, and Atlas embeds them.
3. **Cross-LLM pull:** `stash pull <id>` gives another agent a useful Briefing, not a giant Transcript.
4. **Intelligent merge:** `stash merge <a> <b>` finds duplicates, complementary findings and conflicts across two real Sessions, keeping the evidence.
5. **Adaptive guardrails:** a failure repeated across Sessions → Proposed Guardrail → human approval → included in the next Briefing.
6. **Website:** makes the value of shared context obvious to judges straight away.

## Architecture

TypeScript everywhere ([ADR 0001](docs/adr/0001-typescript-everywhere-nextjs-backend.md)): two apps in one monorepo. All LLM work runs locally, through the developer's own AI tool ([ADR 0005](docs/adr/0005-local-llm-through-the-users-own-ai-tool.md)); Stash holds no LLM key.

```
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

| Component | Role |
| --- | --- |
| Developer's AI tool | All reasoning: Digests, Memories, Merge Findings, Proposed Guardrails. Runs on the developer's machine through whichever tool they use: Claude Code (`claude -p`), Codex (`codex exec`), or any command that reads a prompt on stdin. The model used is recorded as `extractedBy`. |
| MongoDB Atlas | All storage. Automated Embedding embeds Memory text (no embedding provider or key). Vector Search for retrieval. |
| Atlas cluster | The hackathon Sandbox (required): `Cluster0`, M10, MongoDB 9.0.7. Storage auto-scaling must be on for Automated Embedding. Dedicated tier, so embedding rate limits are the paid ones. |

Only Memory text is embedded (model `voyage-4`). Transcripts, Digests and Events are not.

One Vector Search index on `memories` (`autoEmbed` on `text`, filters on `projectId`, `sessionId`, `type`, `status`, `current`) powers merge candidates, repeated-failure detection for Guardrails, related Memories in every Briefing, and website search. Queries pass plain text and are always filtered to the Project.

### Credentials

| Credential | Where it lives |
| --- | --- |
| Stash token | Developer's machine (CLI config) |
| AI tool login | The developer's own (Claude Code, Codex, …). Stash never sees it |
| Atlas connection string | Backend environment |
| Approver secret | Only in the human's head and their browser tab; the server stores a hash |

### Two-laptop demo

Each laptop runs the CLI and its own local Next.js (website + API). Both connect to the same Atlas cluster, so they share Projects, Sessions and Memories. Vercel isn't needed. Both laptops clone the same GitHub demo repo, so they resolve to the same Project.

## CLI (MVP)

```bash
stash login                      # paste a Stash token
stash init                       # create or join the Project from the normalized git remote URL (no remote: asks for a name)
stash push                       # capture → redact → upload → Digest + Memories → Guardrail check
stash pull <session-or-merge-id> [--budget 6000] [--output STASH.md]
stash merge <session-a> <session-b>
stash sessions
stash status
stash guardrails                 # read-only list
```

Push and merge take `--llm claude|codex|cmd` to choose the AI tool for one run. Without it, Stash uses the agent it is running inside, otherwise the tool saved in `~/.stash/config.json` (asked once, from the tools installed).

Deferred: `stash pull --project`, `stash search`, `stash logout`, `stash config`, and any guardrail approve or reject command (never, see ADR 0004).

## Push

1. **Find the session.** Inside Claude Code, read `CLAUDE_CODE_SESSION_ID`. From a separate terminal, list this folder's sessions and ask the user to pick one if there's more than one. `--session <id>` overrides both. Never silently push the wrong session.
2. **Parse.** Read the Claude Code JSONL and keep only the branch the session ended on. Each rewind becomes an Event noting that a branch was abandoned; the abandoned branches themselves aren't captured.
3. **Normalize and filter** into the Universal Context Format.
   - Keep: user and assistant messages, tool calls, relevant tool results, file reads and changes, errors, command output, metadata, timestamps.
   - Drop: thinking blocks, Claude Code internal records, duplicate output.
   - Large outputs: keep useful excerpts (error messages, relevant snippets) plus a reference to what was left out.
4. **Redact locally, before batching.**
   - Match known key formats: Anthropic, OpenAI, AWS, GitHub, Atlas connection strings, JWTs.
   - Match any value from local `.env` files.
   - Replace each match with `[REDACTED:type]`.
   - Report the number of *distinct* secrets removed.
   - If scanning fails, nothing is uploaded. Secrets never appear in logs.
5. **Upload in batches.** Event IDs are stable, so retrying is safe. If nothing changed, push prints "Already up to date (vN)" and no new Version is created.
6. **Process locally, while the CLI shows progress.**
   - The CLI sends the redacted Transcript to the developer's AI tool, which returns a Digest built from the *whole* Transcript plus a full new Memory set, as JSON.
   - The CLI checks the JSON against the schema (one retry with the error), then uploads it. The server rejects any Memory citing an Event that isn't in the Session.
   - That Version's Memories become the Session's current Memories. Earlier Versions stay stored and unchanged.
7. **Lineage.** Search the Transcript for `stash:briefing` markers and record a parent link for each one. A Session can have more than one parent.
8. **Guardrail check** (see below).

## Memories

- **Five types:** Decision, Discovery, Failed Approach, Constraint, Open Question. Memories describe; they never instruct.
- **Status:** Hypothesis or Evidenced (set by the LLM), and Verified (set only by a human). No numeric confidence scores.
- **Ownership:** each Memory belongs to one Session Version and cites the Events behind it.
- **Duplicates:** Memories are not combined across Sessions when stored. Duplicates are handled in Merges, Briefings and search results.

## Pull and Briefing

No LLM call at pull time ([ADR 0002](docs/adr/0002-deterministic-briefings.md)). The Briefing is a fixed template filled from stored data, plus one Vector Search query:

1. Marker line: `stash:briefing <id>@v<version> pull=<pull-id>`
2. Approved Guardrails
3. Objective and current progress
4. Decisions
5. Discoveries
6. Failed Approaches
7. Constraints
8. Open Questions and next steps
9. Related from other Sessions
10. Key evidence excerpts with Event IDs

**Related from other Sessions** comes from one `$vectorSearch` on the `memories` index. The query text is the pulled Session's (or Merge's) objective. The filter is the same Project, current Memories only, and not the pulled source itself. It takes the 8 nearest, drops duplicate texts, and puts Failed Approaches first, so the next agent sees what others already ruled out. Each one shows its status and the Session it came from. The pull record stores which Memories were included.

Every Memory shows its status. A Merge's Briefing shows its conflicts as Conflicting Findings. The default budget is about 6,000 tokens. When content has to be dropped to fit, Stash drops the least important items first, never the Guardrails, rather than cutting off the end. Related Memories from other Sessions are dropped before the Session's own.

## Merge

- Takes exactly two Sessions, using each one's latest processed Version, and records which Versions it used. A Merge can't be used as a source for another Merge.
- Runs from the CLI while you wait, with progress: the server supplies both Sessions and the Vector Search candidates, the developer's AI tool reconciles them, and the CLI uploads the Merge. The website only displays Merges.
- Produces a Digest and Findings: Duplicate, Complementary, Conflicting, Only in one source. Each Finding cites Memories and Events.
- Never changes after it's created and never changes its sources ([ADR 0003](docs/adr/0003-immutable-merge-sources.md)). Newer Versions need a new Merge.
- Can be pulled: `stash pull m_789`.

## Guardrails

After every successful push:

1. Take the new Session's Failed Approach Memories.
2. Use vector search to find similar Failed Approaches in the Project's *other* Sessions.
3. The server returns those matches to the CLI, and the developer's AI tool compares the underlying evidence to decide whether it's really the same failure. Similar wording alone isn't enough.
4. If the failure appears in **2 or more different Sessions** and no Guardrail already covers it, the AI tool drafts a Proposed Guardrail citing the Memories and Events. Guardrails count as covering it whether they are proposed, approved or rejected.
5. Approve or reject happens on the website only and requires the approver secret ([ADR 0004](docs/adr/0004-human-only-approvals.md)).
6. Approved Guardrails go into every Briefing for the Project. A rejected pattern is never proposed again.

No expiry or Guardrail versioning in the MVP.

## Website

| Page | Shows |
| --- | --- |
| Home | Counts and recent activity |
| Sessions | List, plus a detail page: Digest with evidence linked to Transcript Events, and the lineage chain |
| Memories | Vector search, a status filter, and a Verify button (needs the approver secret) |
| Merges | The two sources side by side, with Findings coloured by type |
| Guardrails | Proposed and Approved Guardrails with their evidence, and approve/reject buttons (needs the approver secret) |

No website login and no workspace or access management pages. There's one Workspace, created by a seed script.

## Demo repo

A small TypeScript API on GitHub with two problems planted in it:

1. **Intermittent login failure** with two plausible causes that can each be tested: a race condition in token refresh, and a stale cache. Session A and Session B investigate independently, and Merge reconciles them.
2. **Generated API client** built from a source schema. Agents edit it directly, the build overwrites it or a check fails, and this happens in more than one Session. Stash proposes a Guardrail, it's approved, and it appears in the next Briefing.

Also: a fake API key in `.env` that an agent reads, to show redaction. Every demo Session is a real Claude Code session; none are faked.

## Build order

1. Sandbox Cluster0: storage auto-scaling on, laptop IPs added, database user; then the Vector Search index (auto-embed) and the seed script
2. Demo repo
3. Claude adapter, redaction and push (raw Events)
4. LLM adapters (Claude Code, Codex, any command), then Digest and Memory extraction
5. Pull and Briefing
6. Merge
7. Guardrail proposal
8. Website (Guardrails and Merges pages first)
9. Lineage
10. Record real sessions
11. Rehearse twice

**Cut order if behind:** Home page, then `sessions`/`status`, then the website's lineage chain (keep the data), then the Verify button. Push, pull, merge and Guardrails are never cut.

**Stretch goals:** Okta/Auth0 login, MCP server, a Codex push adapter, a Gemini CLI LLM adapter, chunking for long Sessions on small models, auto-push from a Claude Code hook when a session ends.

## Known limitations (say these in the pitch)

- Each demo laptop has the Atlas credentials, so a determined agent could get around app-level checks. In production the backend is hosted and agents never see its environment.
- Only Claude Code sessions can be pushed. Any agent with a shell can pull, and any AI tool can do the reasoning.
- The server trusts extraction results from the CLI, checking only that every cited Event exists. Quality depends on the developer's model, which is shown on every Version.
- Abandoned branches are recorded only as markers, not captured in full.
