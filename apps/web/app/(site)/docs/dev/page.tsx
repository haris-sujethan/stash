import { renderDoc } from "@/lib/docs";
import { DocPage } from "../doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash developer guide", robots: { index: false, follow: false } };

export default async function Developers() {
  return (
    <DocPage
      doc={await renderDoc("dev")}
      title="Developer guide."
      intro="What is built, how it works inside, every command and option, the API, and troubleshooting."
      current="dev"
      source="docs/DEVELOPMENT.md"
    />
  );
}
