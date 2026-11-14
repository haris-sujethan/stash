// Renders the private docs from Markdown at build time: design/landing/15-bubbles/docs/project.md and BUILD.md.
// Same output as the static docs page: heading ids, a contents rail of h2s, wrapped tables, typographic quotes in
// running text, and appendix sections folded behind one <details>.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Marked } from "marked";

const ROOT = resolve(process.cwd(), "../..");
export const DOC_SOURCES = {
  project: resolve(ROOT, "design/landing/15-bubbles/docs/project.md"),
  build: resolve(ROOT, "BUILD.md"),
} as const;

const slug = (t: string) =>
  t.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface RenderedDoc {
  toc: { id: string; text: string }[];
  html: string;
  hasAppendices: boolean;
}

export async function renderDoc(which: keyof typeof DOC_SOURCES): Promise<RenderedDoc> {
  const md = (await readFile(DOC_SOURCES[which], "utf8")).replace(/^# .*\n/, ""); // the page supplies its own h1
  const toc: { id: string; text: string }[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slug(text);
        if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  let html = (await marked.parse(md)).replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");

  // Typographic apostrophes and quotes in running text only (never inside code or pre).
  let inCode = 0;
  html = html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<(code|pre)\b/.test(part)) inCode++;
        if (/^<\/(code|pre)>/.test(part)) inCode = Math.max(0, inCode - 1);
        return part;
      }
      if (inCode) return part;
      return part.replace(/(\w)&#39;(\w)/g, "$1’$2").replace(/(\w)'(\w)/g, "$1’$2").replace(/&quot;([^&]+?)&quot;/g, "“$1”");
    })
    .join("");

  const cut = html.search(/<h2 id="appendix-/);
  if (cut >= 0) {
    html = html.slice(0, cut) + '<details class="appendices" id="appendices"><summary>Appendices: the original blueprint and the full decision records</summary>' + html.slice(cut) + "</details>";
  }
  return { toc: toc.filter((t) => !t.id.startsWith("appendix-")), html, hasAppendices: cut >= 0 };
}
