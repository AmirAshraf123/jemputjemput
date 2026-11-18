/* Jemput offline support.
   - The site's own pages, styles and scripts: always try the network first (so updates show straight away),
     and fall back to the last copy when there's no signal.
   - Fonts, photos, music and code libraries never change once published, so they come from the saved copy first.
   - Replies and anything else sent to the database always need the network; they're never cached. */
const VERSION = "jemput-v1";
const SHELL = [
  "./", "index.html", "app.html", "edit.html", "invite.html", "privacy.html", "manifest.webmanifest",
  "css/base.css", "css/card.css",
  "js/theme.js", "js/sb.js", "js/base-url.js", "js/config.js", "js/site.js", "js/card.js", "js/stickers.js", "js/words.js",
  "js/effects.js", "js/invite.js", "js/landing.js", "js/dashboard.js",
  "img/logo.svg", "img/favicon.svg", "img/icon-192.png",
];
const LONG_LIVED = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\/|\/storage\/v1\/object\/public\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (LONG_LIVED.test(req.url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;   // the database and sign-in: always live
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("invite.html"))));
});
