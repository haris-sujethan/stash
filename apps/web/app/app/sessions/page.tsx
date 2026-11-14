import Link from "next/link";
import { collections } from "@/lib/db";
import { ago, currentProject, one, type SP } from "@/lib/queries";

export default async function SessionsPage({ searchParams }: { searchParams: SP }) {
  const { project } = await currentProject(one((await searchParams).project));
  if (!project) return <main className="page"><p className="empty">No Projects yet. Run stash init and stash push.</p></main>;
  const c = await collections();
  const sessions = await c.sessions.find({ projectId: project._id }).sort({ updatedAt: -1 }).toArray();
  const counts = new Map(
    (await c.memories.aggregate<{ _id: string; n: number }>([{ $match: { projectId: project._id, current: true } }, { $group: { _id: "$sessionId", n: { $sum: 1 } } }]).toArray()).map((x) => [x._id, x.n]),
  );
  const q = `?project=${project._id}`;
  return (
    <main className="page">
      <div className="page-head">
        <h1>Sessions</h1>
        <p>Every pushed agent session in {project.name}. Push one with <code>stash push</code>.</p>
      </div>
      <section className="panel table-wrap">
        {sessions.length === 0 ? <p className="empty">No Sessions yet.</p> : (
          <table className="list">
            <thead><tr><th>Session</th><th>Agent</th><th>Machine</th><th className="num">Version</th><th className="num">Events</th><th className="num">Memories</th><th>Continued from</th><th>Updated</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td><Link href={`/app/sessions/${s._id}${q}`}>{s.title}</Link><div className="meta"><code>{s._id}</code></div></td>
                  <td>{s.agent === "claude-code" ? "Claude Code" : s.agent}</td>
                  <td>{s.machine.replace(/\.local$/, "")}</td>
                  <td className="num">{s.latestVersion ? `v${s.latestVersion}` : "processing"}</td>
                  <td className="num">{s.eventCount}</td>
                  <td className="num">{counts.get(s._id) ?? 0}</td>
                  <td>{s.lineage.length ? s.lineage.map((l) => <code key={l.pullId}>{l.sourceId}@v{l.sourceVersion} </code>) : <span className="meta">—</span>}</td>
                  <td>{ago(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
