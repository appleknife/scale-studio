// sw.js — the copy of the app that lives on the device.
//
// Everything Scale Studio does — scoring, the tuner, the sight-reading
// generator, the practice log — already runs in the browser, so there is no
// server to be offline from. The only thing missing was a cache: without one,
// a student on a school network that quietly drops the connection sees the
// browser's dinosaur instead of their app.
//
// Two caches, deliberately:
//
//   shell    index.html, the modules the app imports, the stylesheet, the icons —
//            small, fetched at install, and the app is fully usable from it.
//            capture.html and its module are not here: that is a setup page for a
//            computer with a microphone, not something a student needs offline.
//   samples  the teacher's recorded violin, 800 kB. Never precached: it is
//            fetched the first time somebody asks to hear a passage, or when a
//            teacher presses "make this available offline" for a classroom of
//            devices. A student who never uses sight reading never carries it.
//
// VERSION must be bumped on every publish, alongside the ?v= stamps in the HTML
// — the publish routine does both from one number. Without that, a student keeps
// whatever was cached the first time, which is the same stale-code trap the
// stamps exist to avoid.
const VERSION = '202611025600';
const SHELL = 'scale-studio-shell-' + VERSION;
const SAMPLES = 'scale-studio-samples-' + VERSION;

const BASE = [
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/analyze.js',
  'src/app.js',
  'src/clef.js',
  'src/i18n.js',
  'src/journal.js',
  'src/music.js',
  'src/offline.js',
  'src/pitch.js',
  'src/playback.js',
  'src/recorder.js',
  'src/sampler.js',
  'src/score.js',
  'src/sightreading.js',
  'src/staff.js',
  'src/tuner.js',
];

/** The modules are requested with a ?v= stamp; the cache holds them by name. */
const fresh = (cache, request) =>
  cache.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request));

self.addEventListener('install', (event) => {
  // No skipWaiting: a new version waits, and the page offers a reload. Taking
  // over mid-session would swap the code under a running page.
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(BASE))
      .catch(() => {
        /* a shell file failed to fetch — leave the old cache alone */
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL && key !== SAMPLES)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'take-over') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes('/samples/')) {
    // Recorded takes never change name within a version, and they are the bulk
    // of the download: cache first, and only fetched when something needs them.
    event.respondWith(
      caches.open(SAMPLES).then((cache) => fresh(cache, request)),
    );
    return;
  }

  // A navigation to "/" is the same page as index.html; the cache holds it once.
  const key =
    request.mode === 'navigate' && (url.pathname === '/' || url.pathname.endsWith('/'))
      ? 'index.html'
      : request;

  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) {
        // Stale-while-revalidate for the page itself, so a teacher who opens the
        // app online gets the current drawing of a passage even when the service
        // worker has not turned over yet.
        if (request.mode === 'navigate') {
          fetch(request)
            .then((response) => {
              if (response && response.ok) cache.put(key, response.clone());
            })
            .catch(() => {});
        }
        return hit;
      }
      try {
        const response = await fetch(request);
        if (response && response.ok && request.destination !== 'document') {
          cache.put(request, response.clone());
        }
        return response;
      } catch (err) {
        // Offline and not in the cache: for a navigation, the app itself is the
        // best answer we have.
        if (request.mode === 'navigate') return cache.match('index.html');
        throw err;
      }
    }),
  );
});
