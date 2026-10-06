import type { Metadata } from "next";
import type { ReactNode } from "react";

// The Keystatic editor is an internal tool — never index it (same as /panel's layout).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The app's root layout (src/app/layout.tsx) is a pass-through; the public
 * site's <html>/<body> live in src/app/[locale]/layout.tsx. The panel is a
 * separate subtree, so it provides its own document shell here.
 */
export default function KeystaticLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
