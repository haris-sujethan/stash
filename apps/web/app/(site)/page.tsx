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
            <li><a href="#why">Why</a></li>
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
              <li><h3>Push</h3><p>When a session ends, save what the agent learned: what it tried, what worked, what failed.</p><code>stash push</code></li>
              <li><h3>Pull</h3><p>Any agent, on any model, starts exactly where the last one stopped.</p><code>stash pull</code></li>
              <li><h3>Merge</h3><p>Two agents chased the same bug? Combine what both found, disagreements kept.</p><code>stash merge</code></li>
              <li><h3>Learn</h3><p>A mistake made twice becomes a rule you approve. Every agent follows it.</p><code>stash guardrails</code></li>
            </ol>
          </div>
        </section>

        <section className="section" id="why" aria-labelledby="why-title">
          <div className="container">
            <div className="head">
              <h2 id="why-title">Git shares code. Stash shares the context behind it.</h2>
              <p>A handoff doc says what happened. Stash keeps how, why, and what failed.</p>
            </div>
            <table className="compare">
              <thead><tr><th scope="col"></th><th scope="col">handoff.md</th><th scope="col">Stash</th></tr></thead>
              <tbody>
                <tr><th scope="row">After the session ends</th><td>Only what you wrote down</td><td>Everything the agent learned</td></tr>
                <tr><th scope="row">Dead ends</th><td>Usually left out</td><td>Kept, so no one retries them</td></tr>
                <tr><th scope="row">Evidence</th><td>A summary</td><td>Every memory cites its source</td></tr>
                <tr><th scope="row">Another model</th><td>Copy and paste</td><td>One pull, any agent</td></tr>
                <tr><th scope="row">Your team</th><td>Lost in a folder</td><td>One shared memory</td></tr>
              </tbody>
            </table>
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
