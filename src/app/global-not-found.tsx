import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import { NotFoundContent } from "@/components/NotFoundContent";
import "./globals.css";

const heading = Playfair_Display({
  variable: "--font-heading-src",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["600", "700"],
});

const body = Manrope({
  variable: "--font-body-src",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "404 — DREAM.CAR.VAVD",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body className="bg-background text-text antialiased">
        <NotFoundContent />
      </body>
    </html>
  );
}
