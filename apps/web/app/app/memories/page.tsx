import Link from "next/link";
import { MEMORY_TYPES, type Memory } from "@stash/context-format";
import { collections } from "@/lib/db";
import { searchMemories } from "@/lib/vector";
import { currentProject, one, TYPE_LABEL, type SP } from "@/lib/queries";
import { ApproverButton } from "../approver";

export default async function MemoriesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { project } = await currentProject(one(sp.project));
  if (!project) return <main className="page"><p className="empty">No Projects yet.</p></main>;
  const query = (one(sp.q) ?? "").trim();
  const type = one(sp.type) ?? "";
  const status = one(sp.status) ?? "";
  const filter = { ...(type ? { type } : {}), ...(status ? { status } : {}) };
  const c = await collections();

  let rows: (Pick<Memory, "_id" | "type" | "text" | "status" | "sessionId" | "eventIds"> & { score?: number })[];
  if (query) {
    rows = await searchMemories({ projectId: project._id, query, limit: 30, filter });
  } else {
    rows = await c.memories.find({ projectId: project._id, current: true, ...filter } as never).sort({ createdAt: -1 }).limit(100).toArray();
  }
  // The same finding from several Sessions shows once, with every source.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.text.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const titles = new Map((await c.sessions.find({ _id: { $in: [...new Set(rows.map((r) => r.sessionId))] } }, { projection: { title: 1 } }).toArray()).map((s) => [s._id, s.title]));
  const q = `?project=${project._id}`;

  return (
    <main className="page">
      <div className="page-head">
        <h1>Memories</h1>
        <p>What agents learned in {project.name}. Search by meaning (Atlas Vector Search). Verify marks a Memory as confirmed by a human.</p>
      </div>
      <form className="search" action="/app/memories">
        <input type="hidden" name="project" value={project._id} />
        <label className="field"><span className="visually-hidden">Search</span><input name="q" defaultValue={query} placeholder="why do users get logged out?" /></label>
        <select name="type" defaultValue={type} aria-label="Type"><option value="">All types</option>{MEMORY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
        <select name="status" defaultValue={status} aria-label="Status"><option value="">Any status</option><option value="verified">Verified</option><option value="evidenced">Evidenced</option><option value="hypothesis">Hypothesis</option></select>
        <button className="btn" type="submit">Search</button>
      </form>
      <section className="panel">
        <header><h2>{query ? `Closest to “${query}”` : "Current Memories"}</h2><span>{groups.size} shown</span></header>
        {groups.size === 0 ? <p className="empty">Nothing found.</p> : (
          <ul className="rows">
            {[...groups.values()].map((list) => {
              const m = list[0]!;
              return (
                <li key={m._id} className="memory">
                  <p>{m.text}</p>
                  <span className={`tag tag--${m.status}`}>{m.status}</span>
                  <span className="meta">
                    <span>{TYPE_LABEL[m.type]}</span>
                    {list.map((x) => <Link key={x._id} href={`/app/sessions/${x.sessionId}${q}#memory-${x._id}`}>{titles.get(x.sessionId)?.slice(0, 40) ?? x.sessionId}</Link>)}
                    {m.score !== undefined && <span className="score">similarity {m.score.toFixed(2)}</span>}
                    {m.status !== "verified" && <ApproverButton path={`/api/memories/${m._id}/verify`} label="Verify" variant="line" />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
