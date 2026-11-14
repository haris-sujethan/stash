import Link from "next/link";
import { notFound } from "next/navigation";
import { MEMORY_TYPES } from "@stash/context-format";
import { collections } from "@/lib/db";
import { ago, one, TYPE_LABEL, type SP } from "@/lib/queries";
import { ApproverButton } from "../../approver";

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const projectParam = one((await searchParams).project);
  const c = await collections();
  const session = await c.sessions.findOne({ _id: id });
  if (!session) notFound();
  const q = `?project=${projectParam ?? session.projectId}`;
  const [version, memories, events, children] = await Promise.all([
    c.sessionVersions.findOne({ sessionId: id, version: session.latestVersion }),
    c.memories.find({ sessionId: id, current: true }).toArray(),
    c.events.find({ sessionId: id }).sort({ seq: 1 }).limit(2000).toArray(),
    c.sessions.find({ "lineage.sourceId": id }, { projection: { title: 1, lineage: 1 } }).toArray(),
  ]);
  const cited = new Set(memories.flatMap((m) => m.eventIds));
  const d = version?.digest;
  const evLink = (eid: string) => <a key={eid} href={`#e-${eid}`}><code>e:{eid.slice(0, 8)}</code></a>;

  return (
    <main className="page">
      <div className="page-head">
        <span className="crumb"><Link href={`/app/sessions${q}`}>Sessions</Link> / <code>{session._id}</code></span>
        <h1>{d?.objective ?? session.title}</h1>
        {d && <p>{d.progress}</p>}
        <div className="meta">
          <span>{session.agent === "claude-code" ? "Claude Code" : session.agent} on {session.machine.replace(/\.local$/, "")}</span>
          <span>v{session.latestVersion} · {session.eventCount} events</span>
          {session.gitBranch && <span>branch {session.gitBranch}</span>}
          {version?.extractedBy && <span>extracted by {version.extractedBy.tool}{version.extractedBy.model ? ` (${version.extractedBy.model})` : ""}</span>}
          {version?.partial && <span>transcript was cut to fit the model</span>}
          <span>updated {ago(session.updatedAt)}</span>
          <span>pull it: <code>stash pull {session._id}</code></span>
        </div>
      </div>

      {(session.lineage.length > 0 || children.length > 0) && (
        <section className="panel">
          <header><h2>Lineage</h2><span>Sessions that pulled from each other</span></header>
          <div className="body lineage">
            {session.lineage.map((l) => (
              <span key={l.pullId} className="lineage">
                <Link className="node" href={`/app/${l.sourceType === "merge" ? "merges" : "sessions"}/${l.sourceId}${q}`}>{l.sourceId}@v{l.sourceVersion}</Link>
                <span className="arrow">→</span>
              </span>
            ))}
            <span className="node is-self">{session._id}</span>
            {children.map((ch) => (
              <span key={ch._id} className="lineage"><span className="arrow">→</span><Link className="node" href={`/app/sessions/${ch._id}${q}`}>{ch._id}</Link></span>
            ))}
          </div>
        </section>
      )}

      <div className="split">
        <div style={{ display: "grid", gap: "var(--space-lg)" }}>
          {d && (d.completed.length > 0 || d.openTasks.length > 0) && (
            <section className="panel">
              <header><h2>Digest</h2><span>{d.files.length} files</span></header>
              <div className="body">
                {d.completed.map((x, i) => <div key={`c${i}`}><p>Done: {x.text}</p><span className="meta evid">{x.eventIds.slice(0, 4).map(evLink)}</span></div>)}
                {d.openTasks.map((x, i) => <div key={`o${i}`}><p>Next: {x.text}</p><span className="meta evid">{x.eventIds.slice(0, 4).map(evLink)}</span></div>)}
              </div>
            </section>
          )}
          <section className="panel">
            <header><h2>Memories</h2><span>{memories.length} current</span></header>
            {memories.length === 0 && <p className="empty">Not processed yet.</p>}
            <div className="body">
              {MEMORY_TYPES.map((t) => {
                const list = memories.filter((m) => m.type === t);
                if (!list.length) return null;
                return (
                  <div key={t} className="group">
                    <h3>{TYPE_LABEL[t]}</h3>
                    <ul className="rows">
                      {list.map((m) => (
                        <li key={m._id} id={`memory-${m._id}`} className="memory">
                          <p>{m.text}</p>
                          <span className={`tag tag--${m.status}`}>{m.status}</span>
                          <span className="meta evid">
                            {m.eventIds.slice(0, 5).map(evLink)}
                            {m.status !== "verified" && <ApproverButton path={`/api/memories/${m._id}/verify`} label="Verify" variant="line" />}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <section className="panel">
          <header><h2>Transcript</h2><span>{events.length} events · secrets removed</span></header>
          <ol className="transcript">
            {events.map((e) => (
              <li key={e._id} id={`e-${e._id}`} className={cited.has(e._id) ? "is-cited" : undefined}>
                <span className="seq">{e.seq}</span>
                <span className={`type${e.type === "error" || e.tool?.isError ? " type--error" : ""}`}>{e.type.replace("_", " ")}{e.tool ? ` · ${e.tool.name}` : ""}</span>
                <span className="txt">{e.file ? `${e.file.op} ${e.file.path}` : e.type === "tool_call" ? JSON.stringify(e.tool?.input ?? {}).slice(0, 400) : (e.output?.excerpt ?? e.text ?? "").slice(0, 600)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
