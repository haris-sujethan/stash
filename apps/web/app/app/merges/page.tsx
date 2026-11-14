import Link from "next/link";
import { collections } from "@/lib/db";
import { ago, currentProject, one, type SP } from "@/lib/queries";

export default async function MergesPage({ searchParams }: { searchParams: SP }) {
  const { project } = await currentProject(one((await searchParams).project));
  if (!project) return <main className="page"><p className="empty">No Projects yet.</p></main>;
  const c = await collections();
  const merges = await c.merges.find({ projectId: project._id }).sort({ createdAt: -1 }).toArray();
  const titles = new Map((await c.sessions.find({ _id: { $in: merges.flatMap((m) => m.sources.map((s) => s.sessionId)) } }, { projection: { title: 1 } }).toArray()).map((s) => [s._id, s.title]));
  const q = `?project=${project._id}`;
  return (
    <main className="page">
      <div className="page-head">
        <h1>Merges</h1>
        <p>Two Sessions reconciled into one Digest and Findings. A Merge never changes its sources. Create one with <code>stash merge &lt;a&gt; &lt;b&gt;</code>.</p>
      </div>
      <section className="panel">
        {merges.length === 0 ? <p className="empty">No Merges yet.</p> : (
          <ul className="rows">
            {merges.map((m) => {
              const n = (k: string) => m.findings.filter((f) => f.kind === k).length;
              return (
                <li key={m._id}>
                  <Link className="row-link" href={`/app/merges/${m._id}${q}`}>{m.digest.objective}</Link>
                  <div className="meta">
                    <code>{m._id}</code>
                    {m.sources.map((s) => <span key={s.sessionId}>{titles.get(s.sessionId)?.slice(0, 40) ?? s.sessionId} v{s.version}</span>)}
                    <span>{n("conflicting")} conflicting · {n("duplicate")} duplicate · {n("complementary")} complementary · {n("only_in_one")} only in one</span>
                    <span>{ago(m.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
