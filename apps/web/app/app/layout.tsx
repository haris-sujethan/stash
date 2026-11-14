import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import "./app.css";
import { currentProject } from "@/lib/queries";
import { ApproverProvider, LockState } from "./approver";
import { Nav } from "./nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stash", robots: { index: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The project lives in ?project=; the layout reads it from the request URL.
  const url = new URL((await headers()).get("x-stash-url") ?? "/app", "http://stash.local");
  const { project, projects } = await currentProject(url.searchParams.get("project") ?? undefined);
  const query = project ? `?project=${project._id}` : "";
  return (
    <ApproverProvider projectId={project?._id ?? null}>
      <div className="app">
        <header className="bar">
          <Link className="wordmark" href={`/app${query}`}>stash</Link>
          <Nav query={query} />
          <div className="project">
            <span>Project</span>
            {projects.map((p) => (
              <Link key={p._id} href={`${url.pathname}?project=${p._id}`} aria-current={p._id === project?._id ? "true" : undefined}>
                {p.name}
              </Link>
            ))}
            <LockState />
          </div>
        </header>
        {children}
      </div>
    </ApproverProvider>
  );
}
