import { renderDoc } from "@/lib/docs";
import { DocPage } from "./doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash docs", robots: { index: false, follow: false } };

export default async function Docs() {
  return (
    <DocPage
      doc={await renderDoc("docs")}
      title="Stash docs."
      intro="What Stash is, the words it uses, how to install it and how to use it."
      current="docs"
      source="README.md"
    />
  );
}
