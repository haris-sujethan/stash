import { renderDoc } from "@/lib/docs";
import { DocPage } from "../doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash build plan", robots: { index: false, follow: false } };

export default async function BuildPlan() {
  return (
    <DocPage
      doc={await renderDoc("build")}
      title="Stash, the build plan."
      intro="Everything an agent needs to build the MVP from zero. Read it with the docs; where they disagree, MVP.md wins."
      current="build"
      source="docs/BUILD.md"
    />
  );
}
