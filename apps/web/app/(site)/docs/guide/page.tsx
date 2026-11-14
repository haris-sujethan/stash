import { renderDoc } from "@/lib/docs";
import { DocPage } from "../doc-page";

export const dynamic = "force-static";
export const metadata = { title: "Stash guide", robots: { index: false, follow: false } };

export default async function Guide() {
  return (
    <DocPage
      doc={await renderDoc("guide")}
      title="Stash, the guide."
      intro="What is built, how to set it up and use it, how it works inside, and how to develop it."
      current="guide"
      source="README.md"
    />
  );
}
