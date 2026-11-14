# Merges never change their sources; disagreements live in Findings

A Merge records the exact Session Versions it compared and never writes to those Sessions or their Memories. When two sources conflict, the conflict becomes a Conflicting Finding inside the Merge. It is not a `disputed` status on the source Memories. So pulling Session A on its own always gives the same result, whatever Merges have since used it, and Merge itself has no concurrency or ordering problems. Don't add `disputed` to Memory Status. To show a dispute next to a Memory, look up the Merges that cite it.
