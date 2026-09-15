import type { ReactNode } from "react";
import "../globals.css";

export const metadata = { title: "DREAM.CAR.VAVD — публікація", robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafafa",
          color: "#171717",
        }}
      >
        {children}
      </body>
    </html>
  );
}
