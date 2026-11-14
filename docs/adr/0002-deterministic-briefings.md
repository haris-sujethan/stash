# Briefings are rendered from a fixed template, with no LLM call at pull time

All LLM work (Digests, Memories, Merge Findings, Proposed Guardrails) happens during `stash push` and `stash merge`, and the results are stored in Atlas. `stash pull` only reads that structured data, ranks it, fits it to the token budget and renders a fixed-order template. This keeps pulls fast, free and repeatable, which matters both on stage and for agents that pull often. It also means two agents pulling the same Version receive the same Briefing. Don't add an LLM summarisation step at pull time. If Briefings need to be better, improve what gets extracted at push time.

## Vector Search at pull is allowed

Pull runs one `$vectorSearch` to add related Memories from other Sessions, using the pulled objective as the query. That is a database query, not a model writing text, so this decision holds: no LLM generates anything at pull time. A Briefing for the same Version is identical as long as the Project's memory has not changed; when new Sessions are pushed, the related section can include them, which is the point.
