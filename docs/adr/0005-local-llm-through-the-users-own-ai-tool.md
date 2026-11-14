# LLM work runs locally, through the developer's own AI tool

Stash holds no LLM API key. Every reasoning step (Digest and Memory extraction, Merge Findings, the evidence check behind a Proposed Guardrail) runs on the developer's machine. The CLI calls whichever AI command-line tool the developer already uses, such as Claude Code (`claude -p`), Codex (`codex exec`) or any command that reads a prompt on stdin and prints an answer. The CLI then uploads the structured result. The backend only stores, validates and searches. It needs one secret, the Atlas connection string, and embeddings stay with Atlas Automated Embedding, which needs no key either.

This keeps Stash model-agnostic, which is the product's point: a team using Claude, Codex or a local model gets the same memory. It also removes a credential and a bill from the backend.

## Considered Options

- **Server-side Anthropic API (the earlier plan):** rejected. It needs a key the user doesn't want to give, and it ties Stash to one provider.
- **Claude Code only (`claude -p`):** rejected. Stash must work with whatever LLM the developer uses.

## Consequences

- The server trusts extraction results sent by the client. It still rejects any Memory or Finding that cites an Event that doesn't exist in that Session, and Guardrails still need a human (ADR 0004). A modified CLI could upload invented but well-cited Memories; that is accepted for the MVP.
- Quality depends on the developer's model. Each Session Version and Merge records `extractedBy` (tool and model), and the website shows it.
- Pushes and merges count against the developer's own AI plan, and each call adds a few seconds while the tool starts.
- Small models may not fit long Transcripts. The MVP shortens older tool output and warns when a Transcript still doesn't fit; splitting long Sessions into chunks comes later.
- Capturing Sessions is a separate concern: push still reads Claude Code session files only. Any tool can do the reasoning, and any agent can pull.
- Pull stays free of LLM calls (ADR 0002).
