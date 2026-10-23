// Generates DREAM.CAR.VAVD banners: 3 languages x 3 formats, rendered with Playwright.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(import.meta.dirname);
const OUT = resolve(DIR, "out");
mkdirSync(OUT, { recursive: true });

const CONTACT = {
  phone: "+44 7706 054203",
  email: "dream.car.vavd@gmail.com",
  site: "dream-car-vavd.com",
};

const T = {
  uk: {
    tagline: "Автомобільні послуги · Велика Британія",
    services: [
      ["Автопідбір під ключ", "від пошуку до покупки"],
      ["Діагностика та огляд", "комп’ютерна перевірка стану авто"],
      ["SRS / Airbag", "відновлення систем безпеки"],
      ["Авто · Мото · Спецтехніка", "під замовлення з UK та Європи"],
    ],
    cta: "Замовити консультацію",
    ctaSub: "Пишіть у WhatsApp",
  },
  en: {
    tagline: "Automotive Services · United Kingdom",
    services: [
      ["Car Sourcing", "from search to purchase"],
      ["Diagnostics & Inspection", "full vehicle health check"],
      ["SRS / Airbag", "safety system restoration"],
      ["Car · Moto · Plant", "sourced to order, UK & Europe"],
    ],
    cta: "Book a consultation",
    ctaSub: "Message us on WhatsApp",
  },
  ru: {
    tagline: "Автомобильные услуги · Великобритания",
    services: [
      ["Автоподбор под ключ", "от поиска до покупки"],
      ["Диагностика и осмотр", "компьютерная проверка авто"],
      ["SRS / Airbag", "восстановление систем безопасности"],
      ["Авто · Мото · Спецтехника", "под заказ из UK и Европы"],
    ],
    cta: "Заказать консультацию",
    ctaSub: "Пишите в WhatsApp",
  },
};

// One stroke style for every icon: 48x48 viewBox, 2.2px gold line, round caps.
const ICONS = [
  // car
  `<path d="M8 30v-5l4-9a4 4 0 0 1 3.6-2.3h16.8A4 4 0 0 1 36 16l4 9v5"/><path d="M6 30h36v5a2 2 0 0 1-2 2h-3M11 37H8a2 2 0 0 1-2-2"/><circle cx="14" cy="36" r="3.5"/><circle cx="34" cy="36" r="3.5"/><path d="M12 24h24M17.5 36h13"/>`,
  // diagnostics: monitor with pulse line
  `<rect x="6" y="9" width="36" height="24" rx="2.5"/><path d="M18 39h12M24 33v6"/><path d="M11 22h6l3-6 5 11 3-5h9"/>`,
  // airbag: seated person + airbag
  `<circle cx="17" cy="10" r="4"/><path d="M15 17l-3 12h11l5 11"/><path d="M12 29l-3 9"/><circle cx="33" cy="20" r="8"/><path d="M22 22l3-1"/>`,
  // special equipment: excavator
  `<path d="M6 36h22"/><rect x="8" y="22" width="16" height="9" rx="1.5"/><path d="M12 22v-6h7l3 6"/><path d="M24 26l8-12 8 6-3 6"/><path d="M37 26h-5"/><circle cx="10" cy="36" r="2.5"/><circle cx="24" cy="36" r="2.5"/>`,
];
const icon = (i) =>
  `<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[i]}</svg>`;

// Simplified matte crown: one shape, no gems.
const CROWN = `<svg class="crown" viewBox="0 0 120 60"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9cf8d"/><stop offset="1" stop-color="#a98439"/></linearGradient></defs><path fill="url(#g)" d="M10 50 4 14l28 18L60 4l28 28 28-18-6 36z"/><rect x="10" y="52" width="100" height="6" rx="2" fill="url(#g)"/></svg>`;

const PHONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>`;
const MAIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>`;
const WEB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>`;
const WA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>`;

const BASE_CSS = `
@import url(fonts-local.css);
:root{--gold:#d4b46a;--gold-hi:#efd99a;--gold-lo:#9c7a35;--ink:#0b0a0c;--text:#f3ece0;--muted:#b9ad97}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:var(--text);font-family:Montserrat,sans-serif;-webkit-font-smoothing:antialiased}
.b{position:relative;overflow:hidden;background:var(--ink)}
.scene{position:absolute;background:url(car-scene.jpg) center/cover no-repeat}
.frame{position:absolute;inset:18px;border:1.5px solid rgba(212,180,106,.55);pointer-events:none;z-index:5}
.frame::after{content:"";position:absolute;inset:6px;border:1px solid rgba(212,180,106,.18)}
.brand{display:flex;flex-direction:column;align-items:flex-start}
.crown{width:84px;height:42px;margin-bottom:10px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.logo{font-family:"Playfair Display",serif;font-weight:800;letter-spacing:.01em;line-height:1;white-space:nowrap;
  background:linear-gradient(180deg,var(--gold-hi) 0%,var(--gold) 55%,var(--gold-lo) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 10px rgba(0,0,0,.7))}
.logo .dot{color:transparent}
.tag{font-weight:600;text-transform:uppercase;letter-spacing:.22em;color:var(--text);opacity:.92;display:flex;align-items:center;gap:14px}
.tag::before{content:"";width:40px;height:1.5px;background:var(--gold)}
.svc{display:flex;flex-direction:column}
.row{display:flex;align-items:center;border:1px solid rgba(212,180,106,.35);background:linear-gradient(90deg,rgba(20,17,14,.92),rgba(20,17,14,.62));border-radius:14px}
.ic-wrap{flex:none;display:grid;place-items:center;border-radius:50%;border:1.5px solid var(--gold);color:var(--gold);background:rgba(212,180,106,.06)}
.ic{width:62%;height:62%}
.t1{font-weight:700;color:var(--text);line-height:1.15}
.t2{font-weight:500;color:var(--muted);line-height:1.25;margin-top:4px}
.cta{display:inline-flex;align-items:center;gap:14px;background:linear-gradient(180deg,#e2c77f,#b8953f);color:#16110a;font-weight:700;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.cta svg{flex:none}
.cta small{font-weight:600;opacity:.8}
.contacts{display:flex;align-items:center;color:var(--text);font-weight:600}
.contacts span{display:inline-flex;align-items:center;white-space:nowrap}
.contacts svg{color:var(--gold);flex:none}
`;

const services = (t, cls = "") =>
  `<div class="svc ${cls}">${t.services
    .map(([a, b], i) => `<div class="row"><div class="ic-wrap">${icon(i)}</div><div><div class="t1">${a}</div><div class="t2">${b}</div></div></div>`)
    .join("")}</div>`;
const brand = (t) =>
  `<div class="brand">${CROWN}<div class="logo">DREAM.CAR.VAVD</div><div class="tag">${t.tagline}</div></div>`;
const cta = (t) => `<div class="cta">${WA}<div>${t.cta}<br><small>${t.ctaSub}</small></div></div>`;
const contacts = () =>
  `<div class="contacts"><span>${PHONE}${CONTACT.phone}</span><span>${MAIL}${CONTACT.email}</span><span>${WEB}${CONTACT.site}</span></div>`;

const FORMATS = {
  // site hero / YouTube / Facebook link image
  landscape: {
    w: 1920, h: 1080,
    css: `
.b{width:1920px;height:1080px}
.scene{right:0;top:0;width:1080px;height:1080px}
.fade{position:absolute;inset:0;background:linear-gradient(90deg,var(--ink) 0%,var(--ink) 40%,rgba(11,10,12,.75) 52%,rgba(11,10,12,0) 68%),linear-gradient(0deg,rgba(11,10,12,.95) 0%,rgba(11,10,12,0) 22%)}
.l{position:absolute;left:110px;top:92px;width:900px;z-index:2}
.logo{font-size:104px}
.tag{font-size:22px;margin-top:20px}
.svc{gap:16px;margin-top:46px;width:760px}
.row{padding:12px 24px;gap:24px}
.ic-wrap{width:72px;height:72px}
.t1{font-size:30px}.t2{font-size:21px}
.cta{margin-top:34px;padding:14px 34px 14px 24px;font-size:26px}
.cta svg{width:42px;height:42px}.cta small{font-size:18px}
.contacts{position:absolute;left:110px;right:110px;bottom:58px;justify-content:space-between;font-size:26px;z-index:2;padding-top:26px;border-top:1px solid rgba(212,180,106,.3)}
.contacts svg{width:28px;height:28px;margin-right:14px}`,
    html: (t) => `<div class="b"><div class="scene"></div><div class="fade"></div><div class="frame"></div>
<div class="l">${brand(t)}${services(t)}${cta(t)}</div>${contacts()}</div>`,
  },
  // Facebook / Instagram feed post
  square: {
    w: 1080, h: 1080,
    css: `
.b{width:1080px;height:1080px}
.scene{left:0;right:0;top:170px;height:560px;background-position:60% 70%}
.fade{position:absolute;left:0;right:0;top:170px;height:560px;background:linear-gradient(180deg,var(--ink) 0%,rgba(11,10,12,0) 28%,rgba(11,10,12,0) 70%,var(--ink) 100%)}
.top{position:absolute;left:0;right:0;top:52px;z-index:2;display:flex;justify-content:center}
.brand{align-items:center}
.crown{width:64px;height:32px;margin-bottom:6px}
.logo{font-size:76px}
.tag{font-size:16px;margin-top:12px}.tag::before{display:none}
.svc{position:absolute;left:64px;right:64px;top:690px;display:grid;grid-template-columns:1fr 1fr;gap:14px;z-index:2}
.row{padding:14px 16px;gap:14px}
.ic-wrap{width:54px;height:54px}
.t1{font-size:20px}.t2{font-size:15px}
.cta{position:absolute;left:50%;transform:translateX(-50%);top:880px;padding:12px 30px 12px 20px;font-size:21px;z-index:2;white-space:nowrap}
.cta svg{width:34px;height:34px}.cta small{font-size:15px}
.contacts{position:absolute;left:64px;right:64px;bottom:44px;justify-content:space-between;font-size:18px;z-index:2}
.contacts svg{width:20px;height:20px;margin-right:8px}`,
    html: (t) => `<div class="b"><div class="scene"></div><div class="fade"></div><div class="frame"></div>
<div class="top">${brand(t)}</div>${services(t)}${cta(t)}${contacts()}</div>`,
  },
  // Stories / Reels / WhatsApp status
  story: {
    w: 1080, h: 1920,
    css: `
.b{width:1080px;height:1920px}
.scene{left:-60px;right:-60px;top:380px;height:640px;background-position:60% 62%}
.fade{position:absolute;left:0;right:0;top:380px;height:640px;background:linear-gradient(180deg,var(--ink) 0%,rgba(11,10,12,0) 25%,rgba(11,10,12,0) 72%,var(--ink) 100%)}
.top{position:absolute;left:0;right:0;top:150px;z-index:2;display:flex;justify-content:center}
.brand{align-items:center}
.crown{width:80px;height:40px;margin-bottom:8px}
.logo{font-size:96px}
.tag{font-size:21px;margin-top:16px;letter-spacing:.16em}.tag::before{display:none}
.bottom{position:absolute;left:80px;right:80px;bottom:96px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:44px}
.svc{gap:18px;align-self:stretch}
.row{padding:18px 26px;gap:24px}
.ic-wrap{width:76px;height:76px}
.t1{font-size:32px}.t2{font-size:23px}
.cta{padding:18px 40px 18px 26px;font-size:30px;white-space:nowrap}
.cta svg{width:48px;height:48px}.cta small{font-size:21px}
.contacts{flex-direction:column;gap:14px;font-size:28px}
.contacts svg{width:28px;height:28px;margin-right:14px}`,
    html: (t) => `<div class="b"><div class="scene"></div><div class="fade"></div><div class="frame"></div>
<div class="top">${brand(t)}</div><div class="bottom">${services(t)}${cta(t)}${contacts()}</div></div>`,
  },
};

const browser = await chromium.launch();
for (const [fmt, f] of Object.entries(FORMATS)) {
  for (const [lang, t] of Object.entries(T)) {
    const file = resolve(DIR, `_${fmt}-${lang}.html`);
    writeFileSync(file, `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${BASE_CSS}${f.css}</style></head><body>${f.html(t)}</body></html>`);
    const page = await browser.newPage({ viewport: { width: f.w, height: f.h } });
    await page.goto("file://" + file);
    await page.evaluate(() => document.fonts.ready);
    // Fail loudly if any text block overflows its row or the canvas.
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll(".row,.contacts,.logo,.tag,.cta")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth - 20 || el.getBoundingClientRect().left < 20)
        .map((el) => el.className + ": " + el.textContent.slice(0, 40)));
    if (overflow.length) console.log(`OVERFLOW ${fmt}-${lang}:`, overflow);
    await page.screenshot({ path: resolve(OUT, `dreamcarvavd-${fmt}-${f.w}x${f.h}-${lang}.png`) });
    await page.close();
  }
}
await browser.close();
console.log("done");
