// stash guardrails: read-only list. Approving or rejecting happens on the website only (ADR 0004).
import { requireRepoConfig, requireUserConfig } from "../config.js";
import { StashApi } from "../api.js";

export async function guardrails() {
  const user = await requireUserConfig();
  const repo = await requireRepoConfig();
  const { guardrails } = await StashApi.from(user).guardrails(repo.projectId);
  if (guardrails.length === 0) return console.log(`No Guardrails in ${repo.name} yet.`);
  const order = { approved: 0, proposed: 1, rejected: 2 } as const;
  for (const g of [...guardrails].sort((a, b) => order[a.status] - order[b.status])) {
    const sessions = new Set(g.evidence.map((e) => e.sessionId)).size;
    console.log(`${g.status.toUpperCase().padEnd(9)} ${g._id}  ${g.rule}`);
    console.log(`          evidence from ${sessions} sessions: ${g.pattern}`);
  }
  console.log(`\nApprove or reject on the website (needs the approver secret). The CLI is read-only for Guardrails.`);
}
