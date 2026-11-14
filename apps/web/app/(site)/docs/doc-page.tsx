import type { RenderedDoc } from "@/lib/docs";
import { ScrollSpy } from "./scroll-spy";

export function DocPage({ doc, title, intro, current, source }: { doc: RenderedDoc; title: string; intro: string; current: "docs" | "build" | "guide"; source: string }) {
  return (
    <>
      <header className="pill">
        <a className="wordmark" href="/">stash</a>
        <nav aria-label="Main">
          <ul>
            <li><a href="/#how">How it works</a></li>
            <li><a href="/docs" aria-current={current === "docs" ? "page" : undefined}>Docs</a></li>
            <li><a href="/docs/guide" aria-current={current === "guide" ? "page" : undefined}>Guide</a></li>
            <li><a href="/docs/build" aria-current={current === "build" ? "page" : undefined}>Build plan</a></li>
            <li><a className="btn btn--sm" href="/app">Open the app</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <div className="container doc-head">
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className="container doc">
          <nav className="rail" aria-label="Contents">
            <ol>
              {doc.toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}
              {doc.hasAppendices && <li><a href="#appendices">Appendices</a></li>}
            </ol>
          </nav>
          <article className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
        </div>
      </main>
      <footer className="container colophon">Built for Agents in Context Toronto, a MongoDB hackathon. Source: {source}.</footer>
      <ScrollSpy />
    </>
  );
}
