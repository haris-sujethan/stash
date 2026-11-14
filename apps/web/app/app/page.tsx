import Link from "next/link";
import { collections } from "@/lib/db";
import { ago, currentProject, one, projectActivity, type SP } from "@/lib/queries";

const ACTION: Record<string, string> = {
  "project.create": "Project created",
  "session.create": "New Session",
  "version.create": "Pushed a Version",
  "version.process": "Digest and Memories extracted",
  pull: "Briefing pulled",
  "merge.create": "Merge created",
  "guardrail.propose": "Guardrail proposed",
  "guardrail.approve": "Guardrail approved",
  "guardrail.reject": "Guardrail rejected",
  "memory.verify": "Memory verified",
};

export default async function Home({ searchParams }: { searchParams: SP }) {
  const { project } = await currentProject(one((await searchParams).project));
  if (!project) return <main className="page"><div className="page-head"><h1>Nothing here yet</h1><p>Run <code>stash init</code> and <code>stash push</code> in a repository.</p></div></main>;
  const c = await collections();
  const p = project._id;
  const [sessions, memories, merges, proposed, approved, log] = await Promise.all([
    c.sessions.countDocuments({ projectId: p }),
    c.memories.countDocuments({ projectId: p, current: true }),
    c.merges.countDocuments({ projectId: p }),
    c.guardrails.countDocuments({ projectId: p, status: "proposed" }),
    c.guardrails.countDocuments({ projectId: p, status: "approved" }),
    projectActivity(p),
  ]);
  const q = `?project=${p}`;
  return (
    <main className="page">
      <div className="page-head">
        <h1>{project.name}</h1>
        <p>{project.remote ?? "No git remote"} · shared memory for every agent working here.</p>
      </div>
      <div className="stats">
        <Link className="stat" href={`/app/sessions${q}`}><b>{sessions}</b><span>Sessions</span></Link>
        <Link className="stat" href={`/app/memories${q}`}><b>{memories}</b><span>current Memories</span></Link>
        <Link className="stat" href={`/app/merges${q}`}><b>{merges}</b><span>Merges</span></Link>
        <Link className={`stat${proposed ? " is-attention" : ""}`} href={`/app/guardrails${q}`}><b>{proposed}</b><span>Guardrails to review</span></Link>
        <Link className="stat" href={`/app/guardrails${q}`}><b>{approved}</b><span>approved rules</span></Link>
      </div>
      <section className="panel">
        <header><h2>Recent activity</h2><span>in {project.name}</span></header>
        {log.length === 0 && <p className="empty">Nothing yet. Push a session from this repository with stash push.</p>}
        <ul className="rows">
          {log.map((l) => (
            <li key={l._id}>
              <span>{ACTION[l.action] ?? l.action}{l.actor === "approver" ? " by the approver" : ""}</span>
              <span className="meta"><code>{l.target}</code><span>{ago(l.at)}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
