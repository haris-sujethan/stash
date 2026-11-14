import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Stash",
  description: "Shared memory for AI coding agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Geologica:wght,CRSV,SHRP@200..500,0,0..100&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
