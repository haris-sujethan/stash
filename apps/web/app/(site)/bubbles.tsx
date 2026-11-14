"use client";
// Mounts the approved hero animation (design/landing/15-bubbles/bubbles.js, served unchanged from /bubbles.js).
// The layout follows the window: beside the head on wide screens, above it on phones.
import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    StashBubbles?: (fig: Element, opts: Record<string, unknown>) => unknown;
  }
}

export function Bubbles() {
  const fig = useRef<HTMLElement>(null);
  const started = useRef(false);

  const start = () => {
    if (started.current || !fig.current || !window.StashBubbles) return;
    started.current = true;
    const opts: Record<string, unknown> = { area: fig.current.closest(".hero") };
    const fit = () =>
      Object.assign(opts, innerWidth < 960
        ? { cx: 0.5, cy: 0.28, fit: 0.2, fitW: 0.36, fadeLeft: null }
        : { cx: 0.7, cy: 0.5, fit: 0.35, fitW: 0.32, fadeLeft: [0.32, 0.46] });
    fit();
    addEventListener("resize", fit);
    window.StashBubbles(fig.current, opts);
  };

  useEffect(() => {
    document.documentElement.classList.add("js");
    start();
  });

  return (
    <>
      <figure
        ref={fig}
        className="bubbles"
        aria-label="Bubbles of characters arranged like a flower. The outer bubbles, your agents, send what they learn into the middle one, Stash, which grows brighter; when full it briefs every agent, they turn green, use it, fade back to grey and start again."
      >
        <canvas aria-hidden="true" />
        <pre aria-hidden="true">{`   .:::.     .:::.
  :::::::   :::::::
   ':::'  .:::::.  ':::'
         :::@@@:::
   .:::.  ':::::'  .:::.
  :::::::   :::::::
   ':::'     ':::'`}</pre>
      </figure>
      <Script src="/bubbles.js?v=9" strategy="afterInteractive" onReady={start} />
    </>
  );
}

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      className="btn"
      type="button"
      onClick={async (e) => {
        const b = e.currentTarget;
        try {
          await navigator.clipboard.writeText(text);
          b.classList.add("is-done");
          b.textContent = "Copied";
          setTimeout(() => {
            b.classList.remove("is-done");
            b.textContent = "Copy";
          }, 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      Copy
    </button>
  );
}
