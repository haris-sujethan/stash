# Stash

**Your agents forget. Stash remembers.**

When an AI coding agent's session ends, everything it learned is lost. The next session, on another laptop or another model, starts from zero. Stash saves what the agent learned and hands it to the next agent: what it tried, what worked, what failed, and the evidence for each.

Built for Agents in Context Toronto, a MongoDB hackathon. It runs on MongoDB Atlas with Vector Search.

## Key words

These are the words you'll see in the app and the CLI.

| Word | What it means |
| --- | --- |
| **Project** | One code repository. Everyone working in the same GitHub repo shares one Project. |
| **Session** | One conversation with an AI agent, such as one Claude Code chat. |
| **Version** | A snapshot of a Session each time you push it. Push again after more work and you get Version 2. |
| **Push** | Save a Session to Stash (`stash push`). |
| **Event** | One thing that happened in a Session: a message, a command, its output, a file change or an error. |
| **Transcript** | All of a Session's Events in order, with secrets removed. |
| **Memory** | One thing the agent learned, in one sentence, pointing to the Events that prove it. |
| **Memory type** | What kind of thing it is: **Decision** (a choice and why), **Discovery** (something learned), **Failed approach** (something that didn't work, and why), **Constraint** (a limit or requirement) or **Open question** (something still unknown). |
| **Memory status** | How sure we are: **Hypothesis** (inferred, not shown), **Evidenced** (an Event shows it) or **Verified** (a person confirmed it). |
| **Digest** | A short summary of a Session: the goal, where it stands, what's done and what's next. |
| **Briefing** | What `stash pull` prints for the next agent: the Digest, the Memories, rules to follow, and related findings from other Sessions. |
| **Pull** | Get a Briefing (`stash pull <id>`), so an agent starts where the last one stopped. |
| **Merge** | Combine two Sessions that worked on the same problem (`stash merge <a> <b>`). |
| **Finding** | One result of a Merge: **Duplicate** (both found it), **Complementary** (different pieces that fit together), **Conflicting** (they disagree) or **Only in one**. |
| **Guardrail** | A rule Stash suggests after the same mistake happens in two Sessions. It reaches agents only after a person approves it. |
| **Lineage** | Which Session continued which: "continued from ses_…". |
| **Stash token** | Your login for the CLI (`stash login`). |
| **Approver secret** | A password only people know, needed to approve Guardrails or verify Memories. Agents never have it. |
| **AI tool** | The AI you already use (Claude Code, Codex, …). Stash uses it to write Memories. Stash itself holds no AI key. |

## Install

You need Node 26, git, and Claude Code. Stash isn't on npm yet, so you install it from this repository.

```bash
git clone https://github.com/haris-sujethan/stash.git && cd stash
npm install && npm run build
(cd apps/cli && npm link)
```

Put the database connection string in `apps/web/.env.local` as `MONGODB_URI="…"` (ask whoever runs your Stash), then start Stash and log in:

```bash
npm run dev
```

In a second terminal:

```bash
npm run seed
stash login
```

`npm run seed` prints your Stash token; `stash login` asks for it. `npm run dev` must stay running while you use Stash.

## Use it

**1. Set up a repository.** In the repo you work in:

```bash
stash init
```

Commit the `.stash.json` it creates, so your teammates join the same Project.

**2. Push a session.** In Claude Code, type:

```text
! stash push
```

Stash removes secrets on your laptop, saves the Session, and uses your AI tool to write the Digest and Memories.

To push automatically instead, run `stash hooks install` once. Claude Code then saves each turn as you work and does a full push when the session ends.

**3. Pull it anywhere.** On any laptop, in any agent:

```bash
stash pull ses_xxxxxxxx
```

Or tell the agent: *"Run `stash pull ses_xxxxxxxx` and continue from there."*

**4. Merge two sessions** that worked on the same problem:

```bash
stash merge ses_aaaa ses_bbbb
```

**5. Approve rules.** When Stash proposes a Guardrail, open the app's **Guardrails** page, click **Approve**, and type the approver secret. Every future Briefing starts with that rule.

## The app

Open `http://localhost:3000/app`.

| Page | What you see |
| --- | --- |
| **Home** | How many Sessions, Memories, Merges and Guardrails this Project has, and what happened recently |
| **Sessions** | Every pushed Session. Open one for its Digest, Memories, Transcript and Lineage. |
| **Memories** | Everything learned in the Project. Search by meaning, filter by type or status, and verify. |
| **Merges** | Two Sessions side by side, with their Findings |
| **Guardrails** | Rules waiting for approval, and the approved ones |

Switch Projects with the names in the top bar.

## Questions

**Do I need an AI API key?** No. Stash uses the AI tool you already have, with your own login.

**Is Stash always running?** No. It only runs when you type `stash`, or when Claude Code calls it because you ran `stash hooks install`. The web app (`npm run dev`) must be running for the CLI to work.

**Are my secrets safe?** API keys, tokens, database passwords and the values in your `.env` files are replaced with `[REDACTED]` on your laptop before anything is uploaded.

**Can an agent approve its own rules?** No. Approving needs the approver secret, which only people have, and the CLI has no approve command.

**Which agents work?** Pushing works with Claude Code today. Pulling works with any agent that can run a command.

**Is it on npm?** Not yet. Use `npm link` as shown above.

## More

- `docs/DEVELOPMENT.md` (`/docs/dev`): how it works inside, every command and option, the API, and troubleshooting
- `DEMO.md`: the two-laptop demo, step by step
- `BUILD.md` (`/docs/build`): the original build plan
- `GLOSSARY.md`, `MVP.md`, `docs/adr/`: the exact definitions and the decisions behind them
