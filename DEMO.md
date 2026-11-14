# Stash demo guide

Follow this top to bottom. Part 1 to 3 is a warm-up you can do right now: push the Claude Code chat that built Stash, then pull it on laptop 2 and keep going there. Part 4 is the judged demo with `stash-demo`. Part 5 resets everything between rehearsals.

Every command goes in a normal terminal unless it says "in Claude Code". Lines starting with `!` are typed into Claude Code's prompt: the `!` runs a shell command inside the session, so Stash knows exactly which session it is.

---

## Part 0. Before you start (2 minutes)

| Check | Laptop 1 | Laptop 2 |
| --- | --- | --- |
| Web app running (`npm run dev` in `~/Desktop/stash`) | yes, keep it running | Part 2 |
| `stash status` all ✓ | after Part 1 | after Part 2 |
| Claude Code logged in | yes | needed |
| Atlas lets this laptop in | yes | Part 2, step 1 |

Keep `http://localhost:3000/app` open in a browser on each laptop. Both show the same data, because both use the same Atlas cluster.

---

## Part 1. Put this chat into Stash (laptop 1)

1. Log the CLI in with **your** Stash token (the one the seed printed). If you lost it, run `npm run seed` in `~/Desktop/stash` for a new one.

   ```bash
   stash login
   ```

   Paste the token when asked. It is hidden as you type.

2. Join the Project for the Stash repo, and commit the link file.

   ```bash
   cd ~/Desktop/stash && stash init && git add .stash.json && git commit -m "Add Stash project config" && git push
   ```

3. Push the chat. In the Claude Code chat that built Stash, type:

   ```text
   ! stash push
   ```

   This chat is long, so reasoning takes a minute or two, and it reports that older events were left out to fit the model.

4. Copy the Session id it prints (`ses_…`). You also see it in `stash sessions` and on `localhost:3000/app/sessions`.

---

## Part 2. Set up laptop 2 (about 10 minutes)

1. **Atlas access.** If laptop 2 is on the same Wi-Fi as laptop 1, it already has the same public IP and nothing is needed. Otherwise, sign in to Atlas on laptop 2 and go to **Database & Network Access** → **Add Current IP Address**.

2. **Tools.** Install Node 26 (from nodejs.org, or with Homebrew: `brew install node`), git and Claude Code, then sign in to Claude Code. Check with:

   ```bash
   node -v && git --version && claude --version
   ```

3. **Get Stash and build it.**

   ```bash
   cd ~/Desktop && git clone https://github.com/haris-sujethan/stash.git && cd stash && npm install && npm run build
   ```

4. **Install the CLI.**

   ```bash
   cd ~/Desktop/stash/apps/cli && npm link && cd ~/Desktop/stash
   ```

5. **Give it the database secret.** Create `apps/web/.env.local` with the same two lines as on laptop 1. Copy it across with AirDrop or from your password manager, never through GitHub or chat:

   ```text
   MONGODB_URI="mongodb+srv://…your connection string…"
   MONGODB_DB="stash"
   ```

6. **Start the web app** and leave this terminal running.

   ```bash
   cd ~/Desktop/stash && npm run dev
   ```

7. **In a new terminal, get laptop 2's own token and log in.** The Workspace already exists, so the seed won't ask for the approver secret; it just prints a new token.

   ```bash
   cd ~/Desktop/stash && npm run seed
   ```

   ```bash
   stash login
   ```

8. **Check.**

   ```bash
   stash status
   ```

   Everything should be ✓. Then `git pull` brings in the `.stash.json` from Part 1, so `stash status` also shows the Project.

---

## Part 3. Pull this chat on laptop 2 and continue

1. Read the Briefing yourself first:

   ```bash
   cd ~/Desktop/stash && git pull && stash pull ses_XXXX
   ```

   Replace `ses_XXXX` with the id from Part 1. You get the objective, where things stand, decisions, discoveries, failed approaches and open questions, each with its evidence.

2. Start Claude Code in the same folder (`claude`) and tell it:

   ```text
   Run `stash pull ses_XXXX` and read the Briefing. That is the context from the session that built this project on my other laptop. Summarize where things stand and what is left, then wait for me.
   ```

3. When you are done there, push from laptop 2 (`! stash push` in that Claude Code session). On the website, the new Session shows **continued from ses_XXXX**: the chain across both laptops.

---

## Part 4. The judged demo (stash-demo)

**The story:** users of a small API get logged out at random. Two agents on two laptops investigate, share what they learn through Stash, reconcile their findings, and Stash learns a rule from a mistake both of them made.

**The repo:** `github.com/haris-sujethan/stash-demo`. It has two real bugs (a refresh-token race and a cache that is given milliseconds when it expects seconds), a README that wrongly blames database timeouts, and a generated API client that the build overwrites. The answer key is in `BUILD.md` section 16. Don't show it.

### Setup (once per laptop)

Laptop 1 already has `~/Desktop/stash-demo`. On laptop 2:

```bash
cd ~/Desktop && git clone https://github.com/haris-sujethan/stash-demo.git && cd stash-demo && npm install && npm run setup
```

On both laptops, in `~/Desktop/stash-demo`:

```bash
stash init
```

Commit `.stash.json` from one laptop and `git pull` on the other, or just run `stash init` on both. They join the same Project either way, because it is matched by the GitHub remote.

### The run (about 6 minutes on stage)

| # | Where | Do | Show |
| --- | --- | --- | --- |
| 1 | Laptop 1, Claude Code in `stash-demo` | Prompt: *"Users get logged out at random (see the README). Find out why. Run the tests a few times and show evidence."* When it has found the refresh race, prompt: *"Also make refreshSession time out after 2 seconds. Change it directly in src/client/generated.ts, then run npm run build."* Then `! stash push` | Push output: **1 secret redacted** (the fake key in `.env`), Memories extracted. On the website, open the Session and click a Memory's evidence: it jumps to the Event in the Transcript. |
| 2 | Laptop 2, Claude Code in `stash-demo` | Prompt: *"Run `stash pull ses_A` first and read it. Then investigate the /me route and the profile token cache."* | The agent continues from the Briefing. It doesn't reread everything, and it doesn't retry the database timeout. |
| 3 | Laptop 2 | When it has found the cache bug, prompt: *"Make listOrders retry once. Change it directly in src/client/generated.ts, then run npm run check:generated."* Then `! stash push` | Push output: **continued from ses_A**, and **1 Guardrail proposed**. |
| 4 | Either laptop | `stash merge ses_A ses_B` | The Merges page: sources side by side; the duplicate (same flaky test), complementary findings (B answers A's open question about the cache) and the conflict (which bug causes the failing test). |
| 5 | Website, Guardrails | Click **Approve**, type the approver secret | The rule moves to Approved. An agent can't do this: the CLI has no approve command, and the API refuses it without the secret. |
| 6 | Either laptop | `stash pull ses_B` | The Briefing now opens with **Rules every agent follows (approved)**. |
| 7 | Laptop 1 | `stash push` again | **Already up to date.** |

Say the known limitations at the end (they are in the README, section 9).

**If step 3 proposes no Guardrail:** session A's push must have recorded the generated-client edit as a Failed Approach. Check session A's Memories on the website. If it isn't there, rerun step 1's second prompt in session A and push again.

---

## Part 5. Reset between rehearsals

1. **Put the demo repo back** on each laptop, since the agents may have fixed bugs or edited files:

   ```bash
   cd ~/Desktop/stash-demo && git restore . && git clean -fd -e .env -e .stash.json
   ```

2. **Clear Stash's data** (keeps your Workspace, approver secret, token and indexes): ask Claude Code in the `stash` repo to clear the test data, as it did on 2026-11-14.

3. **Old Claude Code sessions** stay on each laptop. `stash push` from inside a session always picks that session, so they don't get in the way.

---

## If something goes wrong

| Problem | Fix |
| --- | --- |
| `Can't reach the Stash API` | The web app isn't running on that laptop: `npm run dev` in `~/Desktop/stash` |
| `db: error` in `stash status` | That laptop's IP isn't allowed in Atlas (Part 2, step 1) |
| Push is slow | Reasoning runs through Claude Code: about 10 to 20 seconds for a demo session, longer for big ones |
| A build error mentions `… 2.ts` | Desktop sync made a duplicate file: `find ~/Desktop/stash/apps/web/.next -name "* 2*" -delete` |
| `stash: command not found` | `cd ~/Desktop/stash/apps/cli && npm link` |

More detail: README.md (also at `localhost:3000/docs/guide`).
