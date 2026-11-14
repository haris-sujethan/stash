"use client";
// Highlights the contents entry for the section being read.
import { useEffect } from "react";

export function ScrollSpy() {
  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(".rail a")];
    const byId = new Map(links.map((a) => [a.getAttribute("href")!.slice(1), a]));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a) => a.classList.remove("is-on"));
          byId.get(en.target.id)?.classList.add("is-on");
        }),
      { rootMargin: "-10% 0px -80% 0px" },
    );
    document.querySelectorAll(".prose h2[id]").forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);
  return null;
}
