# stash: Shared Memory & Context Infrastructure for AI Agents

*Project blueprint*

> This is the long-term vision. What we're building for the hackathon is in [MVP.md](MVP.md), and where the two differ, MVP.md wins.

Stash is shared memory infrastructure for AI agents.

It allows developers to capture, store, retrieve, search, transfer, and merge the working context of AI agents across sessions, machines, developers, projects, and LLM providers.

Today, AI coding agents operate in isolated sessions. When a session ends, much of the context behind the work becomes difficult to access or reuse. A developer might spend hours investigating a problem, reading files, testing solutions, making decisions, and ruling out approaches. Starting a new session often means reconstructing that context manually.

Stash solves this by giving agents a persistent, shared context layer.

Instead of treating every agent session as an isolated interaction, Stash turns sessions into reusable project knowledge.

Developers interact with Stash primarily through a CLI, with a website for browsing, searching, managing, and visualizing stored context.

## Core capabilities

1. **Context portability:** Move working context between sessions, machines, developers, and different LLMs.
2. **Persistent memory:** Build a searchable knowledge base from accumulated agent sessions.
3. **Intelligent merging:** Combine independent agent histories into a unified context while preserving evidence, disagreements, and provenance.
4. **Adaptive guardrails:** Learn from previous failures and propose project-specific constraints for future agents.
5. **Reliable context infrastructure:** Preserve history, track versions, manage permissions, and retrieve relevant information without overwhelming agents.

Stash is not another chatbot memory feature. It is an infrastructure layer that allows multiple agents to build on each other's work.

---

## 2. The Problem

AI agents are becoming increasingly capable, but their working context is fragmented.

A developer might use Claude Code to investigate a bug, GPT to review an implementation, and another agent to research an architectural decision.

Each agent operates within its own environment, session history, memory system, and context window.

This creates several problems.

### 2.1 Isolated sessions

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

### 2.2 Repeated investigations

Without shared historical context, agents repeat work.

An agent might investigate a database issue that another agent already ruled out. Another might retry an approach that previously failed.

This wastes time, tokens, and compute.

### 2.3 No shared project memory

Individual agents may have their own memory systems, but there is no universal place where the collective knowledge of multiple agents can accumulate.

Important information remains scattered across:

- Local session files.
- Chat histories.
- Markdown handoff documents.
- Project documentation.
- Different AI providers.
- Individual developers' machines.

### 2.4 Difficult handoffs

A handoff document can summarize what happened, but it often loses important details.

It may omit the original tool outputs, sequence of events, failed experiments, supporting evidence, and relationships between decisions.

A new agent receives a summary rather than access to the underlying history.

### 2.5 Repeated mistakes

Agents frequently make the same mistakes across different sessions.

They might repeatedly modify generated files, violate project conventions, exceed API rate limits, or use approaches that have already caused problems.

There is no consistent mechanism for turning these experiences into reusable, evidence-backed guardrails.

---

## 3. The Solution: Stash

Stash creates a persistent shared context layer for AI agents.

It captures accessible agent activity, organizes it into structured context, stores it remotely, and makes it available to other agents.

The fundamental idea:

> Git shares code and code history. Stash shares the context, evidence, decisions, and experiences behind agents' work.

Git allows developers to collaborate on the same codebase. Stash allows their agents to collaborate through shared working context.

### The three core commands

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

## 4. How Users Interact With Stash

Stash should have two primary interfaces:

1. A CLI for developers working in their terminal.
2. A website for browsing and managing shared context.

The CLI is the primary interface. The website is the visual management layer.

### 4.1 Installation

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

### 4.2 Push: Save an agent session

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

### 4.3 Pull: Continue work in another session

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

### 4.4 Merge: Combine multiple agent histories

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

## 5. The Stash Website

The website is the visual interface for the knowledge accumulated by agents.

It should not be necessary to manually upload conversations or transcripts through the website. The CLI handles capture and synchronization.

The website provides visibility and control over everything stored in Stash.

### Main sections

#### Dashboard

- Projects.
- Recent sessions.
- Number of stored memories.
- Recent merges.
- Agent activity.
- Guardrail activity.

#### Sessions

- Browse agent sessions.
- View session histories.
- Inspect tool calls and results.
- See decisions and discoveries.
- Trace information back to its source.

#### Memory Explorer

- Search across all sessions.
- Ask questions about previous project work.
- Browse decisions, discoveries, constraints, and failed approaches.
- Inspect the evidence behind individual memories.

#### Merge Explorer

- Select multiple sessions.
- View related findings.
- Identify disagreements.
- Review merged context.
- Inspect the original sources.

#### Guardrails

- Review proposed guardrails.
- Approve or reject changes.
- See the sessions that motivated a rule.
- Manage active rules and expiration.

#### Project and Access Management

- Manage projects.
- Invite collaborators.
- Control permissions.
- Review activity and audit history.

The website makes Stash's accumulated knowledge understandable and manageable.

---

## 6. Cross-LLM Context Portability

Cross-LLM portability is one of Stash's most important differentiators.

Different AI providers maintain different session formats, memory systems, context windows, tool definitions, and interaction patterns.

A session created in Claude Code cannot simply be copied into GPT and expected to resume identically.

Stash solves this by introducing a model-independent representation of agent context.

### 6.1 Universal Agent Context Format

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

### 6.2 Agent-specific adapters

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

#### Example workflow

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

## 7. Persistent Project Memory

Stash should not only preserve individual sessions. It should continuously build a shared memory of the project.

Every pushed session can contribute useful information to the project's knowledge base.

### Types of memory

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

### Memory lifecycle

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

## 8. Intelligent Context Merging

Merging agent histories is more than combining two transcripts.

Stash should understand how the information in different sessions relates to each other.

### 8.1 Merge pipeline

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

### 8.2 Example

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

## 9. Adaptive Guardrails

This is a particularly important part of the product because agents should become more reliable as they accumulate experience.

Stash should learn from previous mistakes and use that knowledge to guide future agents.

Instead of treating every session as a fresh start, Stash identifies recurring patterns across sessions.

### 9.1 How it works

1. **Observe:** Capture failures, rejected actions, repeated mistakes, and successful approaches.
2. **Identify patterns:** Compare events across sessions to identify recurring issues.
3. **Propose a guardrail:** Generate a potential project-specific rule supported by historical evidence.
4. **Validate:** Check the proposed rule against existing policies, project requirements, and security constraints.
5. **Approve:** Require human approval for consequential changes.
6. **Apply:** Inject approved guardrails into future agent context.

### 9.2 Examples

#### Generated files

An agent repeatedly modifies generated files directly, causing build failures.

Stash proposes:

> "Do not directly modify generated files. Update the source schema and regenerate the files."

#### API rate limits

Multiple sessions encounter API rate limits.

Stash proposes:

> "Use request throttling and exponential backoff for this API."

#### Project conventions

Agents repeatedly use inconsistent database access patterns.

Stash proposes:

> "Use the existing repository abstraction for database queries."

### 9.3 Guardrail management

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

## 10. Reliability and Security

Stash is intended to become infrastructure for real agent workloads. It cannot simply store summaries and hope everything works.

Several requirements need to be considered from the beginning.

### Versioning and lineage

Every session should have a stable identity and version.

Merges should reference their source sessions and events.

Changes should not silently overwrite historical information.

### Concurrency

Multiple agents may push context or update project knowledge simultaneously.

Use atomic updates, version checks, and conflict detection.

### Provenance

Every important memory should be traceable to its original session and supporting events.

Agents should be able to distinguish a direct observation from a generated interpretation.

### Access control

Project-level permissions should determine which agents and developers can retrieve information.

Retrieval must respect permissions, not just storage access.

### Secret detection

Before uploading session data, detect and redact sensitive information such as:

- API keys.
- Access tokens.
- Passwords.
- Private credentials.
- Other sensitive environment values.

Provide controls for what can be captured and uploaded.

### Context budgeting

Do not blindly load entire transcripts into a new agent.

Retrieve the most relevant information, prioritize important memories, and respect the target model's context window.

### Stale memory detection

A decision made several months ago may no longer apply after major code changes.

Stash should track timestamps and relevant project versions, and flag potentially outdated knowledge.

### Idempotency and recovery

Repeated uploads should not create duplicate events.

Failed uploads should be recoverable, and ingestion should support retries.

### Auditability

Track who pushed, pulled, merged, approved guardrails, and accessed shared context.

---

## 11. Technical Architecture

Stash should be structured around a lightweight CLI, backend processing service, MongoDB Atlas, and a web application.

### Suggested technology stack

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

### 11.3 MongoDB collections

- **projects** — Stores project metadata, ownership, and configuration.
- **sessions** — Stores session metadata, agent type, objective, timestamps, status, and project references.
- **events** — Stores the original accessible session history. Example event types:
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
- **memories** — Stores extracted and structured project knowledge, including embeddings and provenance.
- **merges** — Stores merged context artifacts and references to their source sessions.
- **guardrails** — Stores proposed and approved project-specific rules.
- **audit_logs** — Stores access and modification history.

Additional collections, such as branches or project memberships, can be introduced as needed.

### 11.4 Why MongoDB Atlas?

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

## 12. CLI Design

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

### Command descriptions

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

## 13. Agent Integrations

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

## 14. How Stash Differs From Existing Memory and Handoff Tools

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

## Last thoughts

100'000 of developers use agents every day. When those sessions end, that data is lost and not used
