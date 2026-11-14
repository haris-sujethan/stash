import { renderDoc } from "@/lib/docs";
import { DocPage } from "./doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash docs (private)", robots: { index: false, follow: false } };

export default async function Docs() {
  return (
    <DocPage
      doc={await renderDoc("project")}
      title="Stash, everything in one place."
      intro="Private docs for the project while it is unpublished: the pitch, the MVP, every decision, the design history and the original blueprint."
      current="docs"
      source="design/landing/15-bubbles/docs/project.md"
    />
  );
}
