// Dear Me, evening reminders (Phase 9). Loaded into the service worker by Workbox (importScripts).
self.addEventListener('push', (e) => {
  let msg = { title: 'Dear Me,', body: 'Your promises are here.' };
  try { if (e.data) msg = { ...msg, ...e.data.json() }; } catch (_) { /* keep the gentle default */ }
  e.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, icon: '/icons/app-icon-180.png', badge: '/icons/app-icon-180.png', tag: 'dearme-evening' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => 'focus' in x);
    return w ? w.focus() : self.clients.openWindow('/');
  }));
});
