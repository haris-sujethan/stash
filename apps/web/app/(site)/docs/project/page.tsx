import { renderDoc } from "@/lib/docs";
import { DocPage } from "../doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash project notes (private)", robots: { index: false, follow: false } };

export default async function ProjectNotes() {
  return (
    <DocPage
      doc={await renderDoc("project")}
      title="Project notes."
      intro="Private docs for the project while it is unpublished: the pitch, the MVP, every decision, the design history and the original blueprint."
      current="project"
      source="design/landing/15-bubbles/docs/project.md"
    />
  );
}
