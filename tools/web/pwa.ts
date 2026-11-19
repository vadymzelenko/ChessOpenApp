/**
 * Make the static web export an installable, offline-capable PWA
 * (ТЗ §2 / §11 «Web офлайн», module 29). Runs after `expo export`:
 *
 *   npx tsx tools/web/pwa.ts <dist> [baseUrl]
 *
 * - writes manifest.webmanifest and sw.js into <dist>;
 * - injects the manifest link, theme colour and SW registration into every
 *   HTML page (a custom +html.tsx drops the JS bundle in this expo-router
 *   version, so pages are patched after export instead).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2];
const base = (process.argv[3] ?? '').replace(/\/$/, '');
if (!dist) {
  console.error('usage: pwa.ts <dist> [baseUrl]');
  process.exit(2);
}
const version = new Date().toISOString();

const manifest = {
  name: 'Chess Open — тренажёр дебютов',
  short_name: 'Chess Open',
  description: 'Бесплатный тренажёр шахматных дебютов',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  background_color: '#1E1D1B',
  theme_color: '#1E1D1B',
  icons: [
    { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

// Network-first for pages (fresh content when online, cached when offline),
// stale-while-revalidate for static assets (hashed bundles, icons, sounds).
const sw = `const CACHE = 'chess-open-${version}';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('${base}/'))),
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }),
    ),
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);

const head =
  `<link rel="manifest" href="${base}/manifest.webmanifest">` +
  `<meta name="theme-color" content="#1E1D1B">` +
  `<link rel="apple-touch-icon" href="${base}/icons/icon-192.png">` +
  `<script>if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('${base}/sw.js',{scope:'${base}/'})})}</script>`;

let pages = 0;
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) {
      const html = readFileSync(p, 'utf8');
      if (!html.includes('manifest.webmanifest')) {
        writeFileSync(p, html.replace('</head>', `${head}</head>`));
        pages++;
      }
    }
  }
};
walk(dist);
console.log(`✓ PWA: manifest, sw.js, ${pages} pages patched (base "${base || '/'}")`);
