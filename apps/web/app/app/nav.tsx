"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/app", "Home"],
  ["/app/sessions", "Sessions"],
  ["/app/memories", "Memories"],
  ["/app/merges", "Merges"],
  ["/app/guardrails", "Guardrails"],
] as const;

export function Nav({ query }: { query: string }) {
  const path = usePathname();
  return (
    <nav aria-label="App">
      {LINKS.map(([href, label]) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link key={href} href={`${href}${query}`} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
