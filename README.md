# Gjallarhorn

A small [Deno](https://deno.com) alerting server. Clients register a
[Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
subscription with the server so they can receive push notifications. SMS
alerting via Twilio is in progress.

> **Status:** early work in progress. Subscriptions are held in memory only and
> are lost on restart, and there is not yet an endpoint that sends an alert.

## The name

In Norse mythology, Gjallarhorn ("the resounding horn") belongs to Heimdallr,
the ever-watchful guardian of Bifröst, the rainbow bridge to Asgard. Heimdallr
needs less sleep than a bird, can see a hundred leagues by night or day, and
hears grass growing. When the end of the world, Ragnarök, comes, he sounds
Gjallarhorn so that its blast is heard across all the worlds and the gods are
called to arms. This project aims to do the same on a smaller scale: keep watch
and make sure the alarm reaches everyone who needs to hear it.

## Requirements

- Deno 2.x (also drives the frontend's npm tooling; Node is not required)
- A VAPID key pair in `gjallarhorn-server/vapid.json`

## Setup

Install the workspace dependencies from the repository root:

```sh
deno install
```

Generate a VAPID key pair with
[`@negrel/webpush`](https://jsr.io/@negrel/webpush):

```ts
// generate-vapid.ts
import * as webpush from "jsr:@negrel/webpush";

const keys = await webpush.generateVapidKeys({ extractable: true });
console.log(JSON.stringify(await webpush.exportVapidKeys(keys), null, 2));
```

```sh
deno run generate-vapid.ts > gjallarhorn-server/vapid.json
```

`vapid.json` contains your private key. Do not commit it.

## Running

The repository is a
[Deno workspace](https://docs.deno.com/runtime/fundamentals/workspaces/) with
two members, `gjallarhorn-server` and `gjallarhorn-web`. All tasks are run from
the repository root:

| Task                   | What it does                                                               |
| ---------------------- | -------------------------------------------------------------------------- |
| `deno task dev`        | Starts the server (`:1234`) and the Vite dev server (`:5173`) in parallel. |
| `deno task dev:server` | Starts only the server, with file watching.                                |
| `deno task dev:web`    | Starts only the Vite dev server.                                           |
| `deno task start`      | Starts the server without file watching.                                   |
| `deno task build`      | Type-checks and builds the web app into `gjallarhorn-web/dist`.            |
| `deno task preview`    | Serves the built web app with Vite.                                        |
| `deno task test`       | Runs the server tests.                                                     |
| `deno task lint`       | Runs `deno lint` on the server and Biome on the web app.                   |

To run a member's own task directly, filter on its name:

```sh
deno task --filter @gjallarhorn/server dev
deno task --filter gjallarhorn-web build
```

The server listens on `http://localhost:1234`.

### Docker

Build the image and run it with the VAPID key file mounted at runtime:

```sh
docker build -t gjallarhorn .
docker run --rm -p 1234:1234 \
  --mount type=bind,src="$(pwd)/gjallarhorn-server/vapid.json",dst=/app/vapid.json,readonly \
  gjallarhorn
```

The key file is not copied into the image.

## API

The server listens on `http://localhost:1234`. Every JSON response has the same
envelope:

```json
{ "message": <payload>, "time": "<ISO 8601 timestamp>" }
```

| Method | Path                                           | Description                               |
| ------ | ---------------------------------------------- | ----------------------------------------- |
| GET    | [`/`](#get-)                                   | Serves the web app (`public/index.html`). |
| GET    | [`/up`](#get-up)                               | Health check.                             |
| GET    | [`/api/subscribers`](#get-apisubscribers)      | Lists registered push subscriptions.      |
| POST   | [`/api/web-subscribe`](#post-apiweb-subscribe) | Registers a push subscription.            |

> Routes are matched on path only. The HTTP method is not checked yet, so for
> example `POST /up` behaves like `GET /up`. There is no authentication.

### `GET /`

Serves [`public/index.html`](./public/index.html) as `text/html; charset=utf-8`.
`HEAD /` is also supported. Other methods on `/` fall through to the default
response below.

### `GET /up`

Health check. Returns `200` once the server has started; the server only starts
after the VAPID keys have loaded.

```sh
curl http://localhost:1234/up
```

```json
{ "message": "I am up!", "time": "2026-11-22T08:58:37.351Z" }
```

### `GET /api/subscribers`

Lists every subscription registered since the server started. `message` is an
array of
[`PushSubscription`](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/toJSON)
objects. It is empty after a restart, because subscriptions are held in memory
only.

```sh
curl http://localhost:1234/api/subscribers
```

```json
{
  "message": [
    {
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "keys": { "p256dh": "...", "auth": "..." }
    }
  ],
  "time": "2026-11-22T08:58:37.381Z"
}
```

> **Warning:** the response includes each subscriber's full endpoint and keys,
> which are enough to send pushes to that subscriber. Do not expose this
> endpoint publicly without adding authentication.

### `POST /api/web-subscribe`

Registers a browser push subscription. The request body is the JSON from
[`PushSubscription.toJSON()`](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/toJSON)
in the browser:

| Field         | Type   | Description                                              |
| ------------- | ------ | -------------------------------------------------------- |
| `endpoint`    | string | Push service URL for this subscription.                  |
| `keys.p256dh` | string | Client public key (base64url), used to encrypt messages. |
| `keys.auth`   | string | Client authentication secret (base64url).                |

```sh
curl -X POST http://localhost:1234/api/web-subscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}'
```

From a browser, after a service worker is registered:

```js
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: "<VAPID public key>",
});
await fetch("http://localhost:1234/api/web-subscribe", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(subscription),
});
```

Responses:

| Status | When                           | `message`                                        |
| ------ | ------------------------------ | ------------------------------------------------ |
| `200`  | Subscription registered        | The registered subscription.                     |
| `200`  | Push server not initialised    | `null`                                           |
| `500`  | Body missing or not valid JSON | Plain-text `Internal Server Error` (no envelope) |

Current limitations:

- The body is not validated. A subscription without `keys` is accepted and
  stored.
- Duplicates are not detected. Subscribing the same browser twice stores it
  twice.

### Other paths

Any other path returns `200` with the same JSON as [`/up`](#get-up).

## Project structure

```text
deno.json                                          Workspace root: members and aggregate tasks
deno.lock                                          Single lockfile for the whole workspace
gjallarhorn-server/                                Deno server (@gjallarhorn/server)
  deno.json                                        Server tasks and dependencies
  main.ts                                          HTTP server and routes
  webpush-server/WebGjallarhorn.ts                 Web Push application server and subscriber handling
  main_test.ts                                     Tests (currently starter template, out of date)
gjallarhorn-web/                                   React/Vite frontend (gjallarhorn-web, package.json member)
alert/sms.js                                       Twilio SMS sender (work in progress)
```

## Testing

```sh
deno task test
```

## TODO

- Persist subscriptions
- Add an endpoint to send alerts to subscribers
- Finish SMS alerting and move credentials to environment variables
- Update the tests to match the current routes

## Architecture

```text
Phone (installed web app + service worker)
   │ HTTPS, same origin
   ▼
Gjallarhorn (Deno)
   ├─ /            static SPA files: index.html, sw.js, manifest.json
   ├─ /api/...     public API: subscribe, unsubscribe, VAPID public key
   └─ /api/admin/… protected: list subscribers, send an alert
          │
          ▼
   Notifier ──► Channels: WebPush | SMS (Twilio) | email…
          │
          ▼
   Subscriber store (Deno KV)
```
