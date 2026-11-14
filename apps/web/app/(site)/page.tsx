// The public landing page, ported from design/landing/15-bubbles (the approved direction). Copy is final.
import { Bubbles, CopyButton } from "./bubbles";

export const metadata = {
  title: "Stash: your agents forget, Stash remembers",
  description: "Shared memory for AI coding agents, across sessions, models and teammates.",
};

const INSTALL = "npm install -g @stash/cli";

export default function Landing() {
  return (
    <>
      <header className="pill">
        <a className="wordmark" href="#top">stash</a>
        <nav aria-label="Main">
          <ul>
            <li><a href="#how">How it works</a></li>
            <li><a href="/docs">Docs</a></li>
            <li><a href="/app">App</a></li>
            <li><a className="btn btn--sm" href="#install">Install</a></li>
          </ul>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <Bubbles />
          <div className="container hero__text">
            <h1 id="hero-title">Your agents forget. Stash remembers.</h1>
            <p className="lead">Shared memory for AI coding agents, across sessions, models and teammates.</p>
            <div className="hero__actions">
              <a className="btn" href="/app">Open the app</a>
              <a className="btn btn--line" href="#install">Install the CLI</a>
            </div>
          </div>
        </section>

        <section className="section" aria-label="The problem">
          <div className="container">
            <p className="statement">
              Every new session starts from zero.{" "}
              <span>You explain the bug again. The agent rereads the same files, then retries what already failed.</span>
            </p>
          </div>
        </section>

        <section className="section section--quiet" id="how" aria-labelledby="how-title">
          <div className="container">
            <div className="head">
              <h2 id="how-title">How it works.</h2>
              <p>Your agents put what they learn in one place, and take it out anywhere.</p>
            </div>
            <ol className="steps">
              <li><h3>Push</h3><div className="step"><p>When a session ends, save what the agent learned: what it tried, what worked, what failed.</p><code>stash push</code></div></li>
              <li><h3>Pull</h3><div className="step"><p>Any agent, on any model, starts exactly where the last one stopped.</p><code>stash pull</code></div></li>
              <li><h3>Merge</h3><div className="step"><p>Two agents chased the same bug? Combine what both found, disagreements kept.</p><code>stash merge</code></div></li>
              <li><h3>Learn</h3><div className="step"><p>A mistake made twice becomes a rule you approve. Every agent follows it.</p><code>stash guardrails</code></div></li>
            </ol>
          </div>
        </section>

        <section className="section section--quiet" id="install" aria-labelledby="install-title">
          <div className="container">
            <div className="handoff">
              <h2 id="install-title">Never write a handoff.md again.</h2>
              <div>
                <p>Install the CLI, then push your first session.</p>
                <div className="install"><code>{INSTALL}</code><CopyButton text={INSTALL} /></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="container">
          <p className="foot__mark" aria-hidden="true">stash</p>
          <div className="foot__row">
            <p>Built for Agents in Context Toronto, a MongoDB hackathon.</p>
            <ul><li><a href="#how">How it works</a></li><li><a href="https://www.mongodb.com/atlas">MongoDB Atlas</a></li></ul>
          </div>
        </div>
      </footer>
    </>
  );
}
