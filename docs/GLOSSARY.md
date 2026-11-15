# Stash

Stash is shared memory infrastructure for AI agents. It stores the working context behind agents' work so that other agents, developers and LLMs can pick it up and build on it.

## Ownership

**Workspace**:
A team or personal account that owns Projects.
_Avoid_: Organization, account, team

**Project**:
One shared codebase inside a Workspace, identified by its repository rather than by any local clone. Every clone of the same repository belongs to the same Project.
_Avoid_: Repo, workspace

**Agent**:
An AI coding tool that does work in a Project and produces Sessions, such as Claude Code or Codex.
_Avoid_: Model, bot, assistant

**AI tool**:
The command-line AI the developer already uses (such as Claude Code or Codex), which Stash runs locally to extract Memories, reconcile Merges and check Guardrail evidence. Stash never holds its key.
_Avoid_: LLM provider, model backend

## History

**Session**:
One continuous conversation with an Agent, as captured by Stash. One native agent session maps to exactly one Session.
_Avoid_: Conversation, chat, run

**Session Version**:
A snapshot of a Session at the moment it was pushed. A new version exists only when the Session has new Events since the last push.
_Avoid_: Revision, snapshot

**Event**:
One thing that observably happened during a Session: a message, a tool call, a tool result, a file read or change, or an error. Events are never edited, and they never contain an interpretation.
_Avoid_: Log entry, record, step

**Transcript**:
The complete, normalized, ordered list of a Session's Events, with secrets removed.
_Avoid_: History, log, raw session

**Universal Context Format**:
The model-independent shape that every Transcript and Digest takes, whichever Agent produced it.
_Avoid_: Context package, unified context

## Knowledge

**Memory**:
One piece of knowledge interpreted from Events, which cites those Events as its evidence. Each Memory belongs to exactly one Session Version. A Session's current Memories are those of its latest processed Version; Memories from earlier Versions are kept but no longer current. A Memory describes what happened or what is known, and it is never worded as an instruction.
_Avoid_: Fact, note, insight, lesson

**Memory Type**:
The kind of knowledge a Memory holds. There are exactly five: **Decision** (a choice that was made, and why), **Discovery** (something learned about the code, system or environment), **Failed Approach** (something that was tried and didn't work, and why), **Constraint** (a known limitation or requirement) and **Open Question** (something still unresolved).
_Avoid_: Lesson, architecture, category

**Memory Status**:
How well a Memory is supported. **Hypothesis**: inferred, with no Event that directly shows it. **Evidenced**: a cited Event directly shows it. **Verified**: a human has confirmed it. Only a human can make a Memory Verified. A Memory Status never changes because of a Merge.
_Avoid_: Confidence, score, certainty

**Session Lineage**:
The record that a Session continued from a Session or Merge that was pulled into it, including the exact Version of the source.
_Avoid_: Parent, ancestry, history

**Digest**:
A structured summary of a Session or Merge: its objective, completed work, decisions, discoveries, failed approaches and open tasks, each with references to its evidence.
_Avoid_: Summary, handoff, context package

**Merge**:
An artifact that reconciles specific Versions of two Sessions into one Digest and a set of Findings. A Merge never changes after it is created and never changes its sources. A newer source Version needs a new Merge.
_Avoid_: Combined session, unified context

**Finding**:
One comparison inside a Merge, citing Memories and Events from the sources. Every Finding has one of four types: **Duplicate** (both sources found the same thing), **Complementary** (different but related things), **Conflicting** (incompatible conclusions) or **Only in one source** (found in one source and not the other). A Conflicting Finding is what "disputed" means in Stash.
_Avoid_: Diff, comparison, conflict

**Briefing**:
What Stash gives an Agent when someone pulls a Session or Merge. It is built from the Digest, relevant Memories and Events (including related Memories from other Sessions), and approved Guardrails, and sized to fit that Agent's context window.
_Avoid_: Context package, prompt, handoff doc

## Rules

**Guardrail**:
A rule that shapes how future Agents work in a Project. It is backed by evidence from past Sessions, and it reaches Agents only once a human has approved it.
_Avoid_: Policy, constraint, lesson

**Proposed Guardrail**:
A Guardrail that Stash has suggested from recurring patterns but no human has approved yet. It never reaches an Agent.
_Avoid_: Draft rule, suggestion

**Approver**:
A human allowed to approve or reject Guardrails and to mark Memories Verified. An Agent can never be an Approver.
_Avoid_: Admin, reviewer, owner

## Actions

**Push**:
Publishing a Session's new Events to Stash, which creates a new Session Version. Pushing a Session that hasn't changed does nothing.
_Avoid_: Upload, sync, save

**Pull**:
Producing a Briefing from a Session or Merge for the Agent that is working now.
_Avoid_: Download, restore, resume
