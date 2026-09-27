import type { ReactNode } from "react";
import "../globals.css";

export const metadata = { title: "DREAM.CAR.VAVD — публікація", robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: ReactNode }) {
  // `!` utilities: globals.css (shared with the public site) has unlayered `body` and
  // `:focus-visible` rules that beat any plain utility class. The gold focus ring is
  // too faint on the light panel, so it is dark there and stays gold in dark mode.
  return (
    <html lang="uk">
      <body
        className="bg-neutral-50! text-neutral-900! dark:bg-neutral-950! dark:text-neutral-100! [&_:focus-visible]:outline-neutral-900! dark:[&_:focus-visible]:outline-gold!"
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
