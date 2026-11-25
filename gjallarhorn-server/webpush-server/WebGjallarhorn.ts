import * as webpush from "@negrel/webpush";

const ADMINEMAIL = "erlendhall@protonmail.com" as const;
let subscribersDb: webpush.PushSubscription[] = [];

type LogLevel = "info" | "warn" | "error";

function log(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
) {
  console[level](JSON.stringify({
    time: new Date().toISOString(),
    source: "WebGjallarhorn",
    level,
    event,
    ...data,
  }));
}

// Only log the push service host; the full endpoint and keys act as credentials.
function endpointHost(subscription: webpush.PushSubscription): string {
  try {
    return new URL(subscription.endpoint).host;
  } catch {
    return "invalid-endpoint";
  }
}

class WebGjallarhorn {
  private vapidKeys?: webpush.ExportedVapidKeys;
  private appServer?: webpush.ApplicationServer;
  private subscriptions: webpush.PushSubscriber[] = [];
  private cryptoKeyPair?: CryptoKeyPair;

  public async initAsync() {
    const startedAt = performance.now();
    log("info", "init.start");

    const vapidUrl = new URL("../vapid.json", import.meta.url);
    this.vapidKeys = JSON.parse(await Deno.readTextFile(vapidUrl));
    if (!this.vapidKeys) {
      log("error", "init.vapid_missing", { path: vapidUrl.pathname });
      throw new Error(`No VAPID keys found in ${vapidUrl}`);
    }
    log("info", "init.vapid_loaded", { path: vapidUrl.pathname });

    this.cryptoKeyPair = await webpush.importVapidKeys(this.vapidKeys);
    this.appServer = await webpush.ApplicationServer.new({
      contactInformation: `mailto:${ADMINEMAIL}`,
      vapidKeys: this.cryptoKeyPair,
    });
    log("info", "init.app_server_ready");

    const stored = [...subscribersDb];
    log("info", "init.restore_start", { count: stored.length });
    for (const subscription of stored) {
      this.onboardSubscriber(subscription);
    }

    log("info", "init.complete", {
      subscribers: this.subscriptions.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  public sendMessage(message: string, to: webpush.PushSubscription) {
    const subscriber = this.subscriptions.find((s) =>
      s.subscription.keys.auth === to.keys.auth &&
      s.subscription.keys.p256dh === to.keys.p256dh
    );

    if (!subscriber) {
      log("warn", "push.subscriber_not_found", { host: endpointHost(to) });
      return;
    }

    const startedAt = performance.now();
    log("info", "push.send", {
      host: endpointHost(to),
      messageLength: message.length,
    });
    subscriber.pushTextMessage(message, {})
      .then(() =>
        log("info", "push.sent", {
          host: endpointHost(to),
          durationMs: Math.round(performance.now() - startedAt),
        })
      )
      .catch((err) =>
        log("error", "push.failed", {
          host: endpointHost(to),
          durationMs: Math.round(performance.now() - startedAt),
          error: String(err),
        })
      );
  }

  /** Onboards a new subscriber.
   * @returns {string} The new push subscriber if successfully onboarded. Otherwise returns null.
   */
  public onboardSubscriber(
    newSubscriber: webpush.PushSubscription,
  ): webpush.PushSubscription | null {
    const newSubscription: webpush.PushSubscriber | undefined = this.appServer
      ?.subscribe(newSubscriber);

    if (newSubscription) {
      this.subscriptions.push(newSubscription);
      subscribersDb = this.subscriptions.map((s) => s.subscription);
      log("info", "subscriber.onboarded", {
        host: endpointHost(newSubscriber),
        total: this.subscriptions.length,
      });
      return newSubscription.subscription;
    }

    log("error", "subscriber.onboard_failed", {
      host: endpointHost(newSubscriber),
      reason: this.appServer
        ? "subscribe returned nothing"
        : "app server not initialised",
    });
    return null;
  }

  public getSubscriptions() {
    log("info", "subscribers.list", { count: this.subscriptions.length });
    return this.subscriptions.map((s) => s.subscription);
  }
}

const webGjallarhorn = new WebGjallarhorn();
await webGjallarhorn.initAsync();
export { webGjallarhorn };
