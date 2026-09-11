import type { ReactNode } from "react";

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
