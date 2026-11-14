# Only a human holding the approver secret can approve Guardrails or verify Memories

Agents have a shell and the CLI's Stash token, so anything the CLI can do, an agent can do. The CLI is therefore read-only for Guardrails and Memory Status. Approving or rejecting a Guardrail, and marking a Memory Verified, require an approver secret. The human types it into the website, where it's held only in that browser tab's memory. The server stores only a hash of the secret and checks it on every such request, so hiding buttons in the UI is not what enforces this. Don't add a CLI approve command, and don't put the secret in any `.env` file, because agents read those.

## Consequences

- The two-laptop demo runs the backend locally, so each laptop has the Atlas credentials, and a determined agent could bypass this check by writing to the database directly. That is accepted for the hackathon. In production the backend is hosted, agents never see its environment, and real login (e.g. Okta/Auth0) replaces the shared secret.
