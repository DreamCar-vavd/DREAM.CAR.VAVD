import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroSection, HERO_PHOTOS } from "./HeroSection";
import uk from "../content/dictionaries/uk";
import en from "../content/dictionaries/en";
import ru from "../content/dictionaries/ru";
import type { Dictionary } from "../content/types";
import type { Locale } from "../lib/i18n/config";

/**
 * Static server render (react-dom/server — no DOM library). The static
 * dictionaries leave the contact links empty — getDictionary fills them from
 * the CMS contact record at runtime — so the test does the same here.
 */
function withContact(dict: Dictionary): Dictionary {
  return {
    ...dict,
    contact: { ...dict.contact, phoneHref: "tel:+447706054203", whatsappUrl: "https://wa.me/447706054203" },
  };
}

function render(dict: Dictionary, locale: Locale): string {
  return renderToStaticMarkup(createElement(HeroSection, { dict: withContact(dict), locale }));
}

const LOCALES: [Locale, Dictionary, string][] = [
  ["uk", uk, "Зателефонувати"],
  ["en", en, "Call Us"],
  ["ru", ru, "Позвонить"],
];

test("the photo is ONE <picture> with desktop and tablet sources and a single mobile <img>", () => {
  const html = render(uk, "uk");
  assert.equal((html.match(/<picture>/g) ?? []).length, 1);
  assert.equal((html.match(/<img /g) ?? []).length, 1, "exactly one <img> — no hidden duplicate banners");

  const sources = [...html.matchAll(/<source ([^>]*)\/?>/g)].map((m) => m[1]);
  assert.equal(sources.length, 2);
  assert.match(sources[0], /media="\(min-width: 1024px\)"/);
  assert.match(sources[0], /hero-workshop-desktop\.webp/);
  assert.match(sources[1], /media="\(min-width: 640px\)"/);
  assert.match(sources[1], /hero-workshop-tablet\.webp/);

  const img = html.match(/<img ([^>]*)\/?>/)?.[1] ?? "";
  assert.match(img, /hero-workshop-mobile\.webp/);
  assert.match(img, /fetchPriority="high"|fetchpriority="high"/);
  assert.equal(/hero-workshop-(desktop|tablet)/.test(img), false, "the fallback <img> only references the mobile photo");
});

test("photo dimensions match the approved source files", () => {
  assert.deepEqual(
    [HERO_PHOTOS.desktop.width, HERO_PHOTOS.desktop.height, HERO_PHOTOS.tablet.width, HERO_PHOTOS.tablet.height, HERO_PHOTOS.mobile.width, HERO_PHOTOS.mobile.height],
    [3364, 1428, 1672, 941, 1600, 1000],
  );
});

test("the large left DreamLogo is gone and the old hero photo is no longer referenced", () => {
  const html = render(uk, "uk");
  assert.equal(html.includes("dream-car-logo.png"), false);
  assert.equal(html.includes("dream-logo__shimmer"), false);
  assert.equal(html.includes("hero-cars-logo-final"), false);
});

test("the sign shimmer overlay is present and decorative", () => {
  const html = render(uk, "uk");
  assert.match(html, /<span class="hero-sign-shimmer" aria-hidden="true"><\/span>/);
});

for (const [locale, dict, callLabel] of LOCALES) {
  test(`three working buttons in ${locale.toUpperCase()}: consultation, WhatsApp, phone`, () => {
    const html = render(dict, locale);
    const contact = withContact(dict).contact;
    const links = [...html.matchAll(/<a ([^>]*)>([^]*?)<\/a>/g)].map((m) => ({ attrs: m[1], text: m[2].replace(/<[^>]+>/g, "") }));
    assert.equal(links.length, 3);

    assert.match(links[0].attrs, new RegExp(`href="/${locale}#contacts"`));
    assert.equal(links[0].text, dict.hero.ctaPrimary);

    assert.ok(links[1].attrs.includes(`href="${contact.whatsappUrl}"`));
    assert.match(links[1].attrs, /target="_blank"/);
    assert.match(links[1].attrs, /rel="noopener noreferrer"/);
    assert.equal(links[1].text, "WhatsApp");

    assert.ok(links[2].attrs.includes(`href="${contact.phoneHref}"`));
    assert.match(links[2].attrs, /href="tel:/);
    assert.equal(links[2].text, callLabel);
    assert.equal(dict.hero.ctaCall, callLabel);
  });
}
