# Stash: developer guide

**Your agents forget. Stash remembers.** Shared memory for AI coding agents, across sessions, models and teammates.

A developer works with Claude Code and runs `stash push`. Stash captures the session, removes secrets on the laptop, and has the developer's own AI tool turn it into a Digest and typed Memories, stored in MongoDB Atlas. Any other agent, on any machine or model, runs `stash pull <id>` and starts where the last one stopped. `stash merge` reconciles two investigations. When the same mistake happens in two sessions, Stash proposes a Guardrail, and once a human approves it, every future agent gets that rule first.

Built for **Agents in Context Toronto**, a MongoDB hackathon, in the hackathon's Atlas Sandbox (Cluster0).

This guide covers what is built, how to set it up, how to use it, how it works inside, and how to develop it.

| If you want… | Read |
| --- | --- |
| To use Stash today | [1. Quick start](#1-quick-start) and [3. Using Stash](#3-using-stash) |
| To run the demo | [8. The demo](#8-the-demo) |
| To understand the design | [4. How it works](#4-how-it-works) |
| To change the code | [6. Developing Stash](#6-developing-stash) |
| The product decisions behind it | `MVP.md`, `GLOSSARY.md`, `docs/adr/`, and `/docs/project` on the running site |
| The original build plan | `BUILD.md` (also `/docs/build`) |

---

## 1. Quick start

### Do I have to install Stash?

Yes, but not from npm yet. The landing page shows `npm install -g @stash/cli`, but the package is not published. For the hackathon you install it from this repository with `npm link`, which puts a `stash` command on your PATH that runs the code in `apps/cli`.

You also need **the Stash web app running** (`npm run dev`). The CLI talks to it at `http://localhost:3000`; it is the API, the website and the docs in one. Each demo laptop runs its own copy, and both connect to the same Atlas cluster, so they share everything.

On this laptop, everything below is already done. `stash` is linked at `/opt/homebrew/bin/stash`.

### What you need

| Need | Why | Check |
| --- | --- | --- |
| Node 26 and npm 11 | Runs the CLI and the web app | `node -v` |
| git | Projects are matched by git remote | `git --version` |
| Claude Code 2.1+ (logged in) | Sessions to push, and the AI that does the reasoning | `claude --version` |
| The Atlas connection string | The web app's only secret | in `apps/web/.env.local` |
| Your Stash token | The CLI's login | printed once by the seed |
| Your approver secret | Approving Guardrails on the website | only in your head |

Stash holds **no LLM API key**. Reasoning runs through the AI tool you already use (Claude Code, Codex, or any command). See [ADR 0005](adr/0005-local-llm-through-the-users-own-ai-tool.md).

### Set up a laptop from zero

```bash
# 1. Get the code and build it
git clone https://github.com/haris-sujethan/stash.git
cd stash
npm install
npm run build

# 2. Install the CLI (puts `stash` on your PATH)
(cd apps/cli && npm link)

# 3. Give the web app its one secret (never commit this file)
cp .env.example apps/web/.env.local
#    then set MONGODB_URI in apps/web/.env.local to the Atlas connection string

# 4. Start the web app (API + website) and leave it running
npm run dev
```

In a second terminal:

```bash
# 5. One time per laptop: get a Stash token
#    (the first run ever also asks you to choose the approver secret)
npm run seed

# 6. Log the CLI in with the token it printed
stash login

# 7. In the repository you work in, join its Project
cd ~/Desktop/stash-demo
stash init
git add .stash.json && git commit -m "Add Stash project config"

# 8. Optional: push automatically from Claude Code (see "Automatic pushes")
stash hooks install
```

In Atlas, also add the laptop's IP under **Database & Network Access**, or the web app cannot reach the cluster.

### Check it works

```bash
stash status
```

```text
✓ API                        http://localhost:3000
✓ Database                   ok
✓ Vector Search index        READY
✓ Token                      valid for wsp_demo1
✓ Project                    stash-demo (prj_…)
```

Then open `http://localhost:3000` (landing page), `/app` (the product) and `/docs` (private docs).

---

## 2. What is built

All twelve milestones from the build plan, except the demo recording itself, are done, tested and verified against the Sandbox cluster.

| # | Milestone | What it gives you | Verified by |
| --- | --- | --- | --- |
| M0 | Monorepo | TypeScript workspaces: CLI, web app, four shared packages | build + tests |
| M1 | Atlas | Collections, indexes, the auto-embedding Vector Search index, the seed | index READY; a Memory is searchable ~4 s after insert |
| M2 | Demo repo | `stash-demo`: a session API with two planted logout bugs and a generated-client trap | flaky test fails 9/30; both fixes make it pass 20/20 |
| M3 | Capture | Reads Claude Code session files; local secret redaction | 28 tests; a real 4,000-line session in 144 ms |
| M4 | Push upload | `login`, `init`, `push`, `sessions`, `status` | 1,423 Events pushed; re-push said "Already up to date"; no secret reached Atlas |
| M5 | Local reasoning | Claude Code / Codex / any-command adapters; Digest and Memory extraction | real session → 10 cited Memories in 15 s |
| M6 | Pull | The Briefing: fixed template, budget, related Memories via Vector Search | 0.9 s; surfaced another session's finding |
| M7 | Merge | Reconcile two Sessions into Findings | 1 conflict, 1 duplicate, 5 complementary; sources byte-identical |
| M8 | Guardrails | Repeated failures become Proposed Guardrails | two real sessions → one proposal; no duplicate on re-check |
| M9 | Website | Home, Sessions, Memories, Merges, Guardrails; approver flow | 401 without the secret; approved rule led the next pull |
| M10 | Lineage | "Continued from" links between Sessions | a session that pulled was linked to its source |
| M11 | Site | Landing page, `/docs`, `/docs/build` inside the app | matches the approved static page; fits a phone |
| M12 | Demo | Record real sessions, rehearse twice | **to do** (see section 8) |

64 automated tests pass (`npm test`).

---

## 3. Using Stash

### The commands

| Command | What it does |
| --- | --- |
| `stash login [--token T] [--api URL]` | Saves your token in `~/.stash/config.json` (readable only by you). Asks for it if not given. |
| `stash init [--name N]` | Joins (or creates) the Project for this repo, matched by its git remote, and writes `.stash.json`. Commit that file. |
| `stash push [--session ID] [--llm claude\|codex\|cmd] [--events-only]` | Captures the agent session, redacts secrets, uploads it, extracts a Digest and Memories with your AI tool, records lineage, and checks for repeated failures. `--events-only` just uploads new Events (no AI call). |
| `stash hooks install [--shared]` · `uninstall` · `status` | Makes Claude Code push automatically in this repo: new Events after every agent turn, a full push when the session ends. `--shared` writes `.claude/settings.json` for the whole team; otherwise `.claude/settings.local.json` (just you). |
| `stash pull <id> [--budget N] [--output FILE]` | Prints a Briefing for a Session (`ses_…`) or Merge (`m_…`). Default budget 6,000 tokens. |
| `stash merge <a> <b> [--llm …]` | Reconciles two Sessions into a Merge. |
| `stash sessions` | Lists the Project's Sessions. |
| `stash status` | Checks the API, database, index, token and Project. |
| `stash guardrails` | Lists Guardrails. Read-only: there is no approve command, by design. |

### Pushing a session

The best way is from inside Claude Code, so Stash knows exactly which session it is in. Either ask the agent to run `stash push`, or type it with Claude Code's shell prefix:

```text
! stash push
```

```text
✓ Capturing session          claude-code 6f2e…  148 events  "Users get logged out at random"
✓ Scanning for secrets       1 redacted
✓ Uploading transcript       148 events (148 new)
✓ Recorded version           v1
✓ Recording lineage          continued from ses_8kq2v@v2
✓ Reasoning locally          claude (claude-sonnet-5-5)  10s
✓ Generating Digest          Investigate intermittent login failures…
✓ Extracting Memories        12 found
✓ Checking repeated failures 1 Guardrail proposed (approve on the website)

Push complete.  Session ses_4m2pq  Version 1
```

From a plain terminal, Stash lists this folder's sessions and asks which one, or you pass `--session <uuid>`. It never guesses silently.

Push again after more work and you get Version 2. Push with nothing new and it says `No changes detected. Already up to date (v1).`

**Which AI tool does the reasoning?** The first match wins: `--llm`; the agent Stash is running inside (Claude Code sets `CLAUDECODE=1`); the tool saved in `~/.stash/config.json`; otherwise Stash detects what is installed, asks once, and saves the answer. `--llm cmd` asks for any command that reads a prompt on stdin and prints an answer (for example `ollama run qwen3`).

### Automatic pushes (hooks)

Stash doesn't run in the background on its own: nothing happens until something calls `stash`. Hooks make Claude Code call it for you, so Stash follows the session as you work:

```bash
stash hooks install
```

| When | What runs | Cost |
| --- | --- | --- |
| After every agent turn (Claude Code's `Stop` hook) | `stash push --hook --events-only`: uploads the turn's new Events | No AI call; about a second, in the background |
| When the session ends (`SessionEnd` hook) | `stash push --hook`: the full push (Version, Digest, Memories, lineage, Guardrail check) | One AI call through your own tool, in the background |

Both run detached, so the agent never waits and a failure never breaks the session; output goes to `~/.stash/logs/<date>.log`. In a repo without `stash init`, or when you're not logged in, the hooks do nothing. Stash's own `claude -p` reasoning calls run with hooks disabled, so they never push themselves.

During the session the website already shows the Session and its Transcript growing turn by turn; the Digest and Memories appear when the session ends (or whenever you run `stash push`). Extraction runs once at the end rather than every turn because each run is an AI call that costs time and usage.

`stash hooks status` shows what's installed; `stash hooks uninstall` removes only Stash's hooks.

### Pulling a Briefing

Any agent with a shell can pull: Claude Code, Codex, Cursor, or a person pasting the output.

```bash
stash pull ses_8kq2v                    # print it
stash pull ses_8kq2v --output STASH.md  # also save it
stash pull m_qntjfqrx                   # a Merge's Briefing
stash pull ses_8kq2v --budget 12000     # more room
```

A Briefing always has the same shape:

1. `stash:briefing ses_8kq2v@v2 pull=p_…`: the marker that records lineage when this agent later pushes.
2. A line saying the content is context, not instructions.
3. **Rules every agent follows (approved)**: Guardrails, never dropped.
4. Where things stand, then Decisions, Discoveries, Failed approaches, Constraints, and Open questions, each Memory tagged `[evidenced]`, `[hypothesis]` or `[verified]` with its evidence ids.
5. **Related from other sessions**: the 8 nearest Memories from other Sessions (Atlas Vector Search on the objective), failed approaches first.
6. Key evidence excerpts.

When it is over budget, whole items are dropped in a fixed order (extra evidence, related Memories, open questions, constraints, hypotheses, discoveries, decisions, failed approaches) and it ends with `Ask for more: stash pull … --budget 12000`.

Tell an agent: *"Run `stash pull ses_8kq2v` first and follow the rules in it."*

### Merging two investigations

```bash
stash merge ses_9wr67wws ses_8ahn0qgp
```

```text
✓ Loading sources            ses_9wr67wws v1 (10 memories), ses_8ahn0qgp v1 (6)
✓ Finding related memories   25 candidate pairs (Vector Search)
✓ Reconciling                claude (claude-sonnet-5-5)  13s
✓ Findings                   1 conflicting, 1 duplicate, 5 complementary, 3 only in one
Merge complete.  m_qntjfqrx   Pull it with: stash pull m_qntjfqrx
```

Findings are **duplicate**, **complementary**, **conflicting** or **only in one source**. A conflict is never settled by majority: it stays a conflict and says what would settle it. A Merge records the exact Versions it used and never changes its sources.

### Guardrails and approving them

After each push, each new Failed Approach is compared with other Sessions' failures. If your AI tool confirms it is the same failure, in two or more Sessions, and no Guardrail (proposed, approved or rejected) covers it, Stash proposes a rule.

To approve: open `http://localhost:3000/app/guardrails`, click **Approve**, and type the approver secret. The secret stays in that browser tab's memory only, never on disk; the **lock** button in the top bar forgets it. From then on the rule leads every Briefing in the Project. **Reject** means that pattern is never proposed again.

Agents cannot approve anything: the CLI has no command for it, and the server returns 401 without the secret, even with a valid token.

### The website

| Page | What it shows |
| --- | --- |
| `/` | The landing page |
| `/docs`, `/docs/dev`, `/docs/project`, `/docs/build` | The short guide, this developer guide, project notes, the build plan |
| `/app` | Counts and recent activity |
| `/app/sessions` | Every Session; open one for its Digest, Memories (with evidence links into the Transcript) and lineage chain |
| `/app/memories` | Search by meaning, filter by type and status, **Verify** (approver secret) |
| `/app/merges` | Merges; open one for both sources side by side and colour-coded Findings |
| `/app/guardrails` | Proposed, approved and rejected rules with their evidence; **Approve** / **Reject** |

Switch Projects with the names in the top bar.

---

## 4. How it works

### The pieces

```text
 Laptop                                              MongoDB Atlas (Sandbox, Cluster0)
 ┌──────────────────────────────────────────┐        ┌──────────────────────────────────┐
 │ Claude Code ──► stash CLI                │        │ sessions, session_versions,      │
 │                 capture → redact →       │        │ events, memories, merges,        │
 │                 your AI tool (claude -p) │  HTTP  │ guardrails, pulls, audit_logs    │
 │                 │                        │ ─────► │                                  │
 │ Next.js app (localhost:3000)             │ driver │ memories_vector: Vector Search   │
 │   API: validate, store, search           │ ─────► │ with Automated Embedding         │
 │   website + docs                         │        │ (voyage-4, no key needed)        │
 └──────────────────────────────────────────┘        └──────────────────────────────────┘
```

- **The CLI** does everything that touches your machine: finding the session, reading it, removing secrets, and running your AI tool.
- **The web app** never calls an LLM. It validates what the CLI sends, stores it, runs Vector Search, renders Briefings, and serves the website.
- **Atlas** stores everything and embeds Memory text itself (Automated Embedding), so there is no embedding key either.

### A push, step by step

1. **Find the session.** `CLAUDE_CODE_SESSION_ID` when inside Claude Code; `--session`; or ask. Sessions Stash started itself (`stash:extract`) are never offered.
2. **Parse** `~/.claude/projects/<folder>/<id>.jsonl`. Follow the branch the session ended on, through attachment records and across context compaction. Parallel tool calls are kept; a rewind becomes one "branch abandoned" Event. Thinking blocks and internal records are dropped. Outputs over 4 KB keep the first 2 KB and last 1 KB plus a hash.
3. **Redact** on the laptop: Anthropic, OpenAI, AWS, GitHub, JWT and private keys, MongoDB credentials, and every value in the repo's `.env` files become `[REDACTED:kind]`. If scanning fails, nothing is uploaded.
4. **Upload** only Events the server does not have, in batches of 500, with retries. Event ids are content hashes, so retries never duplicate.
5. **Record a Version** unless nothing changed. Lineage is recorded here from `stash:briefing` markers.
6. **Reason locally.** The Transcript is rendered with short ids (`e12`), fitted to the model, and sent to your AI tool with a JSON schema. The answer is checked: unknown citations dropped, "evidenced" downgraded unless a tool result, error or file change shows it, instructions reworded as descriptions. The server checks again, stores the Memories, and makes them the Session's current set.
7. **Guardrail check** (above).

### Words

| Term | Meaning |
| --- | --- |
| Workspace | The account that owns Projects (one, seeded) |
| Project | One repository, matched by normalized git remote, so every clone shares it |
| Session / Version | One agent conversation / a snapshot of it at each push |
| Event | One observed thing: a message, tool call, result, file change, error. Never edited |
| Memory | One piece of knowledge citing its Events: Decision, Discovery, Failed Approach, Constraint or Open Question; status Hypothesis, Evidenced or Verified (human only) |
| Digest | The structured summary of a Session or Merge |
| Briefing | What `pull` prints |
| Merge / Finding | Two Sessions reconciled / one comparison inside it |
| Guardrail | A human-approved rule learned from repeated failures |

Full definitions: [`GLOSSARY.md`](../GLOSSARY.md).

### Decisions that look wrong without context

| ADR | Decision |
| --- | --- |
| [0001](adr/0001-typescript-everywhere-nextjs-backend.md) | TypeScript everywhere: one CLI and one Next.js app (no Python backend) |
| [0002](adr/0002-deterministic-briefings.md) | No LLM at pull time; one Vector Search query is allowed |
| [0003](adr/0003-immutable-merge-sources.md) | Merges never change their sources; disagreements live in Findings |
| [0004](adr/0004-human-only-approvals.md) | Only a human with the approver secret approves; the CLI is read-only |
| [0005](adr/0005-local-llm-through-the-users-own-ai-tool.md) | No LLM key: reasoning runs through the developer's own AI tool |

### Vector Search, everywhere it is used

One index (`memories_vector`) on `memories.text`, with filters on `projectId`, `sessionId`, `type`, `status` and `current`. Queries are plain text.

| Use | Query | Cut-off |
| --- | --- | --- |
| Pull: related Memories | the pulled objective | top 8, none |
| Merge candidates | each Memory of A, against B | 0.82 (`MERGE_CANDIDATE_MIN`) |
| Guardrail detection | each new Failed Approach, against other Sessions | 0.70 (`GUARDRAIL_MATCH_MIN`) |
| Website search | what you type | top 30 |

Cut-offs were measured on the cluster: Memories about the same bug score 0.80 to 0.93; the same mistake on two different functions scored 0.73; unrelated Memories in one project 0.60 to 0.67. The AI tool's judgement, not the score, decides merges and Guardrails.

---

## 5. Configuration and secrets

| What | Where | Committed? |
| --- | --- | --- |
| Atlas connection string | `apps/web/.env.local` → `MONGODB_URI` | **Never** (git-ignored) |
| Database name, index, model | `apps/web/.env.local` → `MONGODB_DB=stash`, `VECTOR_INDEX`, `EMBED_MODEL` | Template in `.env.example` |
| Optional tuning | `MERGE_CANDIDATE_MIN`, `GUARDRAIL_MATCH_MIN` | No |
| Stash token + AI tool choice | `~/.stash/config.json` (mode 600) | No (it's in your home folder) |
| Project link | `.stash.json` in each repo you push from | **Yes** |
| Approver secret | Your head; the server stores a scrypt hash | No |
| AI tool login | Claude Code / Codex's own login | Stash never sees it |

`.gitignore` excludes `.env*` (except `.env.example`), `pass.txt`, keys and build output. Keep the connection string in a password manager; `pass.txt` is no longer needed.

The seed: `npm run seed` creates the Workspace the first time (asking for the approver secret) and prints a **new token every run** (one per laptop). `npm run seed -- --reset-approver` changes the secret; `npm run seed -- --schema-only` only (re)creates indexes.

---

## 6. Developing Stash

### Layout

```text
stash/
├── apps/
│   ├── cli/                  @stash/cli: the `stash` command
│   │   └── src/  commands/ (one file per command), discover.ts, redact.ts, reason.ts, api.ts, config.ts
│   └── web/                  Next.js 16: API + website + docs
│       ├── app/(site)/       landing page and /docs (Vantage styles)
│       ├── app/app/          the product pages and the approver dialog
│       ├── app/api/          route handlers
│       ├── lib/              db, auth, vector search, briefing, merge, guardrails, lineage, docs
│       ├── public/bubbles.js the hero animation, unchanged from the approved design
│       └── scripts/          seed.ts, probe-vector.ts
├── packages/
│   ├── context-format/       data model + API shapes (zod)
│   ├── core/                 ids, hashing, prompts, validators, Briefing builder, merge and guardrail logic
│   ├── agent-adapters/       Claude Code session reader
│   └── llm-adapters/         claude / codex / cmd adapters, runStructured()
├── design/landing/           all design explorations; 15-bubbles is the approved one
├── docs/adr/                 decision records
├── README.md  MVP.md  BUILD.md  GLOSSARY.md  BLUEPRINT.md
└── .env.example
```

### Everyday commands

```bash
npm run dev          # web app on :3000 (hot reload)
npm run build        # build every workspace (packages first, then CLI and web)
npm test             # 64 tests, no network, no LLM (fake AI tools)
npm run typecheck
npm run seed         # see section 5
```

After changing a package or the CLI, run `npm run build` so the linked `stash` and the dev server pick it up (packages are consumed from their `dist/`). Restart `npm run dev` if the server doesn't notice.

### Where to change things

| To change… | Edit |
| --- | --- |
| What gets extracted from a session | `packages/core/src/extract.ts` (schema, instructions, validator) |
| The Briefing's shape or drop order | `packages/core/src/briefing.ts` |
| How Merges are reconciled | `packages/core/src/merge.ts` |
| When a Guardrail is proposed | `packages/core/src/guardrails.ts` and `apps/web/lib/guardrails.ts` |
| Secret patterns | `apps/cli/src/redact.ts` |
| Reading Claude Code files | `packages/agent-adapters/src/claude-code.ts` |
| Adding an AI tool | `packages/llm-adapters/src/index.ts` (one adapter function) |
| A website page | `apps/web/app/app/<page>/page.tsx`, styles in `app/app/app.css` |
| The docs | `design/landing/15-bubbles/docs/project.md`, `BUILD.md`, this README |

### The API

Every route except `/api/status` and the approver routes needs `Authorization: Bearer <stash token>`.

| Route | Purpose |
| --- | --- |
| `GET /api/status` | Health; with a token, whether it is valid |
| `POST /api/projects/init` | Create or join a Project by remote |
| `POST /api/sessions/resolve` | Find/create the Session; returns known Event ids |
| `POST /api/sessions/:id/events` | Upload a batch of Events (idempotent) |
| `POST /api/sessions/:id/versions` | Record a Version (or "unchanged"); records lineage |
| `POST /api/sessions/:id/versions/:n/extraction` | Store the Digest and Memories; switch current |
| `GET /api/sessions?projectId=` | List Sessions |
| `POST /api/pull` | Render a Briefing |
| `POST /api/merges/prepare`, `POST /api/merges`, `GET /api/merges/:id` | Merge |
| `GET /api/guardrails/candidates`, `POST /api/guardrails`, `GET /api/guardrails` | Guardrail proposals |
| `POST /api/guardrails/:id/approve` · `/reject` · `POST /api/memories/:id/verify` | Approver only (`X-Approver-Secret`) |

---

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Can't reach the Stash API at http://localhost:3000` | Start the web app: `npm run dev` |
| `/api/status` says `db: error` | Laptop IP not allowed in Atlas, or `MONGODB_URI` wrong |
| Index not `READY`, or search finds nothing new | Storage auto-scaling must be on for Cluster0 (Automated Embedding pauses without it). New Memories take a few seconds to embed. |
| `Not logged in` / `Invalid Stash token` | `npm run seed` for a token, then `stash login` |
| `This repository isn't set up for Stash` | `stash init` in the repo |
| `More than one Claude Code session for this folder` | Push from inside Claude Code, or pass `--session <uuid>` |
| Build fails mentioning a file like `routes.d 2.ts` | Desktop sync created a duplicate in Next's cache: `find apps/web/.next -name "* 2*" -delete` |
| `stash: command not found` | `npm run build && (cd apps/cli && npm link)` |
| Push says the answer failed validation twice | The AI tool returned bad JSON twice; run `stash push` again (Events are already uploaded) or use a stronger model |
| A pull shows no "Related from other sessions" | There is only one Session in the Project, or nothing is similar enough |

---

## 8. The demo

Two laptops, one Atlas cluster. The demo repo is [`stash-demo`](https://github.com/haris-sujethan/stash-demo): a session API whose users get logged out at random. The README blames database timeouts (a red herring). There are two real causes, a refresh-token race and a cache that takes seconds but is given milliseconds, plus a generated API client that the build overwrites. The answer key is in `BUILD.md` section 16, not in the demo repo.

The database is clean (test data was cleared on 2026-11-14; your Workspace, token and approver secret were kept). Every demo session must be a real Claude Code session.

**Run sheet**

1. **Laptop 1**, `stash-demo`, Claude Code: *"Users get logged out at random. Find out why."* Let it find the refresh race. `! stash push`: one secret redacted (the fake key in `.env`), Memories extracted.
2. **Laptop 2**, a fresh agent: `stash pull <ses_A>`. It continues without re-investigating and doesn't retry the database timeout.
3. Laptop 2's agent investigates the cache and pushes: the website shows "continued from ses_A".
4. `stash merge ses_A ses_B`: the Merges page shows the duplicate, the complementary cache finding and the conflict.
5. Both sessions hand-edited `src/client/generated.ts`: the Guardrails page shows a proposal with evidence from both. Approve it with the secret.
6. `stash pull ses_B`: the rule now leads the Briefing.
7. `stash push` again: "Already up to date". Click any Memory: its source Event.

For step 5, agents don't always hand-edit the generated client by themselves; if they don't, nudge one with "make the change in the client".

**Laptop 2 setup:** section 1's setup steps, its IP in Atlas, `apps/web/.env.local` copied privately, `npm run seed` for its own token. Your login is shared; the Sandbox is the same.

---

## 9. Known limitations (say these in the pitch)

- Each demo laptop runs the backend with the Atlas credentials, so a determined agent could bypass app checks by writing to the database. In production the backend is hosted and agents never see its environment.
- Only Claude Code sessions can be pushed. Any agent can pull, and any AI tool can reason.
- The server trusts the extraction the CLI sends, checking that every cited Event exists. Quality depends on the developer's model, which is shown on every Version.
- Abandoned branches are recorded as markers, not captured.
- The website has no login (one seeded Workspace); approvals are protected by the approver secret.
- The Codex adapter follows Codex's documentation but hasn't been run (Codex isn't installed on laptop 1).
- `@stash/cli` is not published to npm yet.

**Stretch ideas:** Okta/Auth0 login, an MCP server for pull and search, auto-push from a Claude Code hook when a session ends, a Codex push adapter, a Gemini CLI adapter, chunking long sessions for small models.
