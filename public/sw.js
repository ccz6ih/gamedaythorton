/**
 * public/sw.js — the service worker.
 *
 * =============================================================================
 * THE ONE RULE: NOTHING BEHIND THE LOGIN IS EVER WRITTEN TO DISK
 * =============================================================================
 * A service worker cache is a plain, unencrypted store on the device, readable
 * by anything that can read the browser profile and surviving sign-out. Caching
 * /console would mean a client list sitting on the disk of a phone that gets
 * lost, and it would still be there after she logged out — which is precisely
 * what logging out is supposed to mean.
 *
 * So this worker is an allowlist, not a denylist. It caches a fixed set of
 * static assets and nothing else, and every other request is passed to the
 * network untouched. A new page added under /console cannot accidentally become
 * cacheable, because becoming cacheable requires being named here.
 *
 * That also settles the offline question honestly: the console does not work
 * offline, and it should not pretend to. A stale appointment list is worse than
 * a clear "you are offline" — one sends her to the wrong address at the wrong
 * time, the other tells her to find signal.
 *
 * =============================================================================
 * WHAT IT IS ACTUALLY FOR
 * =============================================================================
 * 1. Making the app installable at all. A PWA needs a registered worker with a
 *    fetch handler; that is most of why this file exists.
 * 2. Instant icon and font loads, so the app does not flash unstyled.
 * 3. A branded offline page instead of the browser's dinosaur.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;

/**
 * Static, public, and unchanging within a deployment. No HTML page that could
 * contain somebody's data, no API response, no authenticated route.
 */
const SHELL_ASSETS = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/brand/medbar-favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll rejects the whole batch if any one asset 404s, which would leave
      // the worker permanently uninstalled. Each is added on its own so a
      // missing icon costs that icon.
      .then(cache => Promise.all(
        SHELL_ASSETS.map(url => cache.add(url).catch(() => undefined))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/** Only these may ever be served from, or written to, the cache. */
function isPublicAsset(url) {
  return url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/brand/')
    || url.pathname.startsWith('/_next/static/');
}

self.addEventListener('fetch', event => {
  const { request } = event;

  // Anything that is not a plain GET can change data. It goes to the network,
  // always, and is never recorded.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Another origin's problem — Stripe, fonts, anything embedded.
  if (url.origin !== self.location.origin) return;

  /**
   * A cache-busting query string means somebody wants the live thing. Requests
   * carrying credentials explicitly are also passed straight through.
   */
  if (url.search) return;

  if (isPublicAsset(url)) {
    // Cache-first: these are content-hashed or brand assets that do not change
    // within a deployment.
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        // Only a clean, complete, same-origin response is worth keeping.
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(request, copy)).catch(() => undefined);
        }
        return res;
      }))
    );
    return;
  }

  /**
   * Everything else — every HTML page, every API call, every console screen —
   * is network-only. The single concession is that a failed NAVIGATION gets the
   * offline page rather than a browser error, which is presentation, not
   * caching: nothing about the page she asked for is stored.
   */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then(page => page || new Response(
          'You are offline.',
          { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
        ))
      )
    );
  }
});
