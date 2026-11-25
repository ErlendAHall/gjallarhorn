# Gjallarhorn Web

The React/Vite frontend lets visitors subscribe this device to Gjallarhorn push
alerts.

## Configuration

Set `VITE_VAPID_PUBLIC_KEY` to the base64url-encoded public VAPID key in a local
`.env.local` file. The app posts push subscriptions to `/api/web-subscribe`,
which should return a JSON response with a truthy `message` on success.

Push notifications require a secure context (HTTPS, or localhost during
development). The service worker is served from `/sw.js`.

## Development

Run from this directory (or use `deno task --filter gjallarhorn-web <task>` from
the repository root):

```sh
deno install
deno task dev
deno task build
deno task lint
```
