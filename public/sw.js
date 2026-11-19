// Minimal service worker: lets Folio show reminder notifications on browsers that
// require one (e.g. Chrome on Android) and brings the app forward when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length > 0) await windows[0].focus();
      else await self.clients.openWindow("/");
    })(),
  );
});
