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
//            The score renderer (vendor/, 1.4 MB) is kept the same way: fetched
//            the first time a score is opened in Listen, then there offline.
//
// VERSION must be bumped on every publish, alongside the ?v= stamps in the HTML
// — the publish routine does both from one number. Without that, a student keeps
// whatever was cached the first time, which is the same stale-code trap the
// stamps exist to avoid.
const VERSION = '202611120915';
const SHELL = 'scale-studio-shell-' + VERSION;
// The recordings and the score renderer do not change from one publish to the
// next, so their cache is not named after VERSION: a new version used to throw
// away 2 MB the device had been asked to keep, while the page went on saying it
// was stored. Bump SAMPLES_REV by hand when a take is re-recorded or the file in
// vendor/ is replaced.
const SAMPLES_REV = '1';
const SAMPLES = 'scale-studio-samples-r' + SAMPLES_REV;

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
  'src/pet.js',
  'src/petart.js',
  'src/petroom.js',
  'src/buddy.js',
  'src/ink.js',
  'src/follow.js',
  'src/sprint.js',
  'src/sprintview.js',
  'src/listen.js',
  'src/listenview.js',
  'src/musicxml.js',
  'src/intonation.js',
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

/**
 * Cache first, and what had to be fetched is kept. The keeping is the point:
 * without it "make this available offline" downloaded every take and stored
 * none of them.
 */
const fresh = async (cache, request) => {
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  // Only whole, good answers: a 206 (a media element asking for a byte range)
  // cannot be stored, and a 404 should not be.
  if (response && response.status === 200) {
    try {
      await cache.put(request, response.clone());
    } catch {
      /* storage full or refused — the answer is still good for this visit */
    }
  }
  return response;
};

self.addEventListener('install', (event) => {
  // No skipWaiting: a new version waits, and the page offers a reload. Taking
  // over mid-session would swap the code under a running page.
  event.waitUntil(
    caches
      .open(SHELL)
      // Fresh from the server, never the browser's HTTP cache: GitHub Pages lets
      // a file be cached for ten minutes, so a version published soon after the
      // last one used to be installed with the *previous* version's code inside
      // it — a new page with nothing behind its new buttons, until the next
      // update came along.
      // No catch: if a shell file fails to fetch, the install must fail. A
      // swallowed error let this worker install with an empty cache and then,
      // on activation, delete the previous version's — the device lost its
      // offline copy because of one dropped request. A failed install leaves the
      // old worker and its cache in charge, and the browser tries again later.
      .then((cache) => cache.addAll(BASE.map((path) => new Request(path, { cache: 'reload' })))),
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

  if (url.pathname.includes('/samples/') || url.pathname.includes('/vendor/')) {
    // Recorded takes never change name within a version, and they are the bulk
    // of the download: cache first, and only fetched when something needs them.
    event.respondWith(
      caches.open(SAMPLES).then((cache) => fresh(cache, request)),
    );
    return;
  }

  // A file stamped for a different version than this cache holds belongs to a
  // newer page. That happens because the page itself is refreshed in the
  // background (below) before this worker has handed over: the new page then
  // asked for its new code and styles, and — matched by name — got this cache's
  // old ones. A new button with no code behind it. Such a file comes from the
  // network instead, and only falls back to the old copy when offline.
  const stamp = url.searchParams.get('v');
  if (stamp && stamp !== VERSION) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(SHELL).then((cache) => cache.match(request, { ignoreSearch: true })),
      ),
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
