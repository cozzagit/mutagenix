// Service worker — enables PWA installability + notification handling

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Handle notification click — open or focus the arena page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate to arena
        for (const client of clientList) {
          if (client.url.includes('/lab') || client.url.includes('/arena')) {
            client.focus();
            client.navigate('/arena');
            return;
          }
        }
        // Otherwise open a new window
        return clients.openWindow('/arena');
      }),
  );
});
