import Link from "next/link";
import { collections } from "@/lib/db";
import { ago, currentProject, one, type SP } from "@/lib/queries";
import { ApproverButton } from "../approver";

export default async function GuardrailsPage({ searchParams }: { searchParams: SP }) {
  const { project } = await currentProject(one((await searchParams).project));
  if (!project) return <main className="page"><p className="empty">No Projects yet. Run stash init and stash push.</p></main>;
  const c = await collections();
  const guardrails = await c.guardrails.find({ projectId: project._id }).sort({ createdAt: -1 }).toArray();
  const memIds = guardrails.flatMap((g) => g.evidence.map((e) => e.memoryId));
  const [memories, sessions] = await Promise.all([
    c.memories.find({ _id: { $in: memIds } }).toArray(),
    c.sessions.find({ _id: { $in: guardrails.flatMap((g) => g.evidence.map((e) => e.sessionId)) } }, { projection: { title: 1, machine: 1 } }).toArray(),
  ]);
  const mem = new Map(memories.map((m) => [m._id, m]));
  const ses = new Map(sessions.map((s) => [s._id, s]));
  const q = `?project=${project._id}`;
  const groups = [
    ["proposed", "Proposed", "Stash found the same failure in more than one Session. Nothing reaches an agent until you approve it."],
    ["approved", "Approved", "These lead every Briefing for this Project."],
    ["rejected", "Rejected", "Never proposed again."],
  ] as const;

  return (
    <main className="page">
      <div className="page-head">
        <h1>Guardrails</h1>
        <p>Rules learned from repeated failures. Approving or rejecting needs the approver secret; agents can only read them.</p>
      </div>
      {groups.map(([status, title, note]) => {
        const list = guardrails.filter((g) => g.status === status);
        if (status === "rejected" && list.length === 0) return null;
        return (
          <section key={status} className="panel" aria-labelledby={`g-${status}`}>
            <header><h2 id={`g-${status}`}>{title}</h2><span>{list.length ? note : ""}</span></header>
            {list.length === 0 ? (
              <p className="empty">{status === "proposed" ? "No proposals. They appear after a push finds the same failure in two Sessions." : "None yet."}</p>
            ) : (
              list.map((g) => (
                <article key={g._id} className="guardrail">
                  <div className="meta"><span className={`tag tag--${g.status}`}>{g.status}</span><code className="id">{g._id}</code><span>proposed {ago(g.createdAt)}</span>{g.extractedBy && <span>by {g.extractedBy.tool}{g.extractedBy.model ? ` (${g.extractedBy.model})` : ""}</span>}</div>
                  <p className="rule">{g.rule}</p>
                  <p>{g.rationale}</p>
                  <div className="evidence">
                    <span className="meta">Evidence from {new Set(g.evidence.map((e) => e.sessionId)).size} Sessions · pattern: {g.pattern}</span>
                    {g.evidence.map((e) => (
                      <div key={e.memoryId}>
                        <Link href={`/app/sessions/${e.sessionId}${q}#memory-${e.memoryId}`}>{ses.get(e.sessionId)?.title ?? e.sessionId}</Link>
                        <p>{mem.get(e.memoryId)?.text ?? "(memory not found)"}</p>
                        <span className="meta evid">{e.eventIds.slice(0, 4).map((id) => <Link key={id} href={`/app/sessions/${e.sessionId}${q}#e-${id}`}><code>e:{id.slice(0, 8)}</code></Link>)}</span>
                      </div>
                    ))}
                  </div>
                  {g.status === "proposed" && (
                    <div className="actions">
                      <ApproverButton path={`/api/guardrails/${g._id}/approve`} label="Approve" />
                      <ApproverButton path={`/api/guardrails/${g._id}/reject`} label="Reject" variant="line" />
                      <span className="note">Needs the approver secret.</span>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        );
      })}
    </main>
  );
}
