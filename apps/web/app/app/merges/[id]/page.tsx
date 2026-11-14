import Link from "next/link";
import { notFound } from "next/navigation";
import { collections } from "@/lib/db";
import { ago, KIND_LABEL, one, TYPE_LABEL, type SP } from "@/lib/queries";

export default async function MergePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const projectParam = one((await searchParams).project);
  const c = await collections();
  const merge = await c.merges.findOne({ _id: id });
  if (!merge) notFound();
  const [memories, sessions] = await Promise.all([
    c.memories.find({ $or: merge.sources.map((s) => ({ sessionId: s.sessionId, version: s.version })) }).toArray(),
    c.sessions.find({ _id: { $in: merge.sources.map((s) => s.sessionId) } }).toArray(),
  ]);
  const mem = new Map(memories.map((m) => [m._id, m]));
  const side = new Map(merge.sources.map((s, i) => [s.sessionId, i === 0 ? "A" : "B"]));
  const q = `?project=${projectParam ?? merge.projectId}`;
  const kinds = ["conflicting", "duplicate", "complementary", "only_in_one"] as const;

  return (
    <main className="page">
      <div className="page-head">
        <span className="crumb"><Link href={`/app/merges${q}`}>Merges</Link> / <code>{merge._id}</code></span>
        <h1>{merge.digest.objective}</h1>
        <p>{merge.digest.progress}</p>
        <div className="meta"><span>{ago(merge.createdAt)}</span>{merge.extractedBy && <span>reconciled by {merge.extractedBy.tool}{merge.extractedBy.model ? ` (${merge.extractedBy.model})` : ""}</span>}<span>pull it: <code>stash pull {merge._id}</code></span></div>
      </div>

      <div className="two">
        {merge.sources.map((s, i) => {
          const session = sessions.find((x) => x._id === s.sessionId);
          const list = memories.filter((m) => m.sessionId === s.sessionId);
          return (
            <section key={s.sessionId} className="panel">
              <header><h2>{i === 0 ? "A" : "B"} · {session?.title.slice(0, 48) ?? s.sessionId}</h2><span>v{s.version}</span></header>
              <ul className="rows">
                {list.map((m) => (
                  <li key={m._id} className="memory">
                    <p>{m.text}</p>
                    <span className={`tag tag--${m.status}`}>{m.status}</span>
                    <span className="meta"><span>{TYPE_LABEL[m.type]}</span><Link href={`/app/sessions/${s.sessionId}${q}#memory-${m._id}`}>in session</Link></span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="panel" aria-labelledby="findings">
        <header>
          <h2 id="findings">Findings</h2>
          <span className="legend">{kinds.map((k) => <span key={k} className={`finding finding--${k}`}>{KIND_LABEL[k]} {merge.findings.filter((f) => f.kind === k).length}</span>)}</span>
        </header>
        <ul className="rows">
          {merge.findings.map((f, i) => (
            <li key={i} className={`finding finding--${f.kind}`}>
              <span className="kind">{KIND_LABEL[f.kind]}</span>
              <p>{f.summary}</p>
              <span className="meta">
                {f.memoryIds.map((mid) => {
                  const m = mem.get(mid);
                  return m ? <Link key={mid} href={`/app/sessions/${m.sessionId}${q}#memory-${mid}`}>{side.get(m.sessionId)}: {m.text.slice(0, 60)}{m.text.length > 60 ? "…" : ""}</Link> : null;
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
