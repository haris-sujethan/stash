import type { ReactNode } from "react";

export const metadata = {
  title: "Stash",
  description: "Shared memory for AI coding agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
