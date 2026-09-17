const CACHE_VERSION = "veeghub-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(["/offline.html"]).catch(() => {});
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete all old caches
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
          ),
        ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Never intercept Next.js internals — browser cache handles them
  if (url.pathname.startsWith("/_next/")) return;

  // Never intercept auth or API routes
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for public static assets only
  if (
    request.destination === "image" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              caches
                .open(CACHE_VERSION)
                .then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
        );
      }),
    );
    return;
  }

  // Network-first for navigation with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline.html")) || new Response("Sin conexión", { status: 503 });
        }),
    );
  }
});

// --- Notificaciones push de leads ---

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Veeghub", body: event.data.text() };
  }

  const title = payload.title || "Veeghub";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      // Android draws the badge as a silhouette from the alpha channel only.
      badge: "/badge-96.png",
      vibrate: [100, 50, 100],
      // tag collapses repeat notifications for the same lead into one.
      tag: payload.tag || "veeghub",
      renotify: true,
      // A lead is worth an alert that waits on screen until it is seen.
      requireInteraction: true,
      data: { url: payload.url || "/admin/leads" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || "/admin/leads";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse an open Veeghub window instead of stacking new tabs.
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }

        return self.clients.openWindow(target);
      }),
  );
});
