self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Erenler", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      var watching = clients.some(function (client) {
        return client.visibilityState === "visible" && client.url.indexOf("/admin/live") !== -1 && client.url.indexOf("/admin/live/") === -1;
      });
      if (watching) return undefined;
      return self.registration.showNotification(data.title || "Erenler", {
        body: data.body || "",
        tag: data.tag || "erenler-live",
        renotify: true,
        requireInteraction: data.tag === "live-waiting",
        data: { url: data.url || "/admin/live" },
      });
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/admin/live";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (var index = 0; index < clients.length; index += 1) {
        var client = clients[index];
        if (client.url.indexOf("/admin/live") !== -1 && client.url.indexOf("/admin/live/") === -1 && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
