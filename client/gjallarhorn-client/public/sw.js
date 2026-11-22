// Gjallarhorn service worker: receives Web Push alerts and shows them as notifications.

const DEFAULT_TITLE = "Gjallarhorn";
const SUBSCRIBE_URL = "/api/web-subscribe";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Payload is either plain text or JSON: { title?, body?, url? }
function parsePayload(data) {
  if (!data) return { title: DEFAULT_TITLE, body: "" };
  try {
    const json = data.json();
    return {
      title: json.title ?? DEFAULT_TITLE,
      body: json.body ?? "",
      url: json.url,
    };
  } catch {
    return { title: DEFAULT_TITLE, body: data.text() };
  }
}

self.addEventListener("push", (event) => {
  const { title, body, url } = parsePayload(event.data);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      data: { url: url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((c) => c.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});

// The browser may rotate or expire a subscription; re-subscribe and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const subscription = event.newSubscription ??
      await self.registration.pushManager.subscribe(event.oldSubscription.options);

    await fetch(SUBSCRIBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  })());
});
