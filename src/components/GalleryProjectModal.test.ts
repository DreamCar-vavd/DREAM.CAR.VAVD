import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GalleryProjectModal, GalleryVideoButton } from "./GalleryProjectModal";
import uk from "../content/dictionaries/uk";
import en from "../content/dictionaries/en";
import ru from "../content/dictionaries/ru";

/**
 * Static server render (react-dom/server — no DOM library): enough to prove
 * which of the two states the modal hands to the visitor.
 */
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function renderModal(youtubeWatchUrl: string | null): string {
  return renderToStaticMarkup(
    createElement(GalleryProjectModal, {
      dict: uk,
      locale: "uk",
      project: {
        id: "maserati-levante",
        images: [{ src: "/images/cms/gallery/maserati-levante/_pub/test.jpg", width: 4, height: 3 }],
        youtubeWatchUrl,
      },
      onClose: () => {},
      onNavigate: () => {},
    }),
  );
}

test("modal with a valid video link: active link opening the normalized YouTube URL in a new tab, no disabled button", () => {
  const html = renderModal(WATCH);
  assert.match(html, /<a [^>]*href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ"/);
  assert.match(html, /<a [^>]*target="_blank"[^>]*>/);
  assert.match(html, /<a [^>]*rel="noopener noreferrer"[^>]*>[^]*?Дивитися відео на YouTube/);
  assert.equal(html.includes("Відео ще не додано"), false);
  assert.equal(html.includes('disabled=""'), false);
});

test("modal without a (valid) video link: a real disabled <button>, no YouTube link at all", () => {
  const html = renderModal(null);
  assert.match(html, /<button type="button" disabled=""[^>]*>[^]*?Відео ще не додано<\/button>/);
  assert.equal(html.includes("youtube.com"), false);
  assert.equal(html.includes("Дивитися відео на YouTube"), false);
});

test("video button renders the right label for each locale in both states", () => {
  for (const d of [uk, en, ru]) {
    const labels = { watchLabel: d.gallery.modal.watchVideoLabel, comingSoonLabel: d.gallery.modal.videoComingSoonLabel };
    const active = renderToStaticMarkup(createElement(GalleryVideoButton, { watchUrl: WATCH, ...labels }));
    const disabled = renderToStaticMarkup(createElement(GalleryVideoButton, { watchUrl: null, ...labels }));
    assert.match(active, new RegExp(`^<a [^>]*href="${WATCH.replace(/[.?]/g, "\\$&")}"[^>]*>[^]*${labels.watchLabel}</a>$`));
    assert.match(disabled, new RegExp(`^<button type="button" disabled=""[^>]*>[^]*${labels.comingSoonLabel}</button>$`));
  }
});
