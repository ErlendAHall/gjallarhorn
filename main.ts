import { webGjallarhorn } from "./webpush-server/WebGjallarhorn.ts";
import * as webpush from "jsr:@negrel/webpush";

const INDEX_HTML = new URL("./client/public/index.html", import.meta.url);

/**
 * HTTP entry point for the Gjallarhorn server.
 *
 * Routes are matched on path only; the HTTP method is not checked. JSON
 * responses use the envelope `{ message, time }`. See the API section of
 * README.md for full request and response examples.
 *
 * - `GET /`: serves `public/index.html`.
 * - `GET /up`: health check.
 * - `GET /api/subscribers`: lists registered push subscriptions, including
 *   their keys. Unauthenticated, so do not expose publicly.
 * - `POST /api/web-subscribe`: registers a `PushSubscription` JSON body.
 *   Returns the subscription, `null` if the push server is not initialised, or
 *   500 if the body is not valid JSON.
 * - Any other path: same response as `/up`.
 */
export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/" && (req.method === "GET" || req.method === "HEAD")) {
    const html = await Deno.readFile(INDEX_HTML);
    return new Response(req.method === "HEAD" ? null : html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname === "/up") {
    return Response.json({
      message: "I am up!",
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/subscribers") {
    return Response.json({
      message: webGjallarhorn.getSubscriptions(),
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/web-subscribe") {
    const response = await handleNewSubscriber(req);
    return Response.json({
      message: response,
      time: new Date().toISOString(),
    });
  }

  return Response.json({
      message: "I am up!",
      time: new Date().toISOString(),
    });
}

/**
 * Parses the request body as a `PushSubscription` and onboards it.
 * The body is not validated, and a body that is not valid JSON throws.
 * @returns The registered subscription, or `null` if onboarding failed.
 */
async function handleNewSubscriber(req: Request) {
  const payload: webpush.PushSubscription = await req.json();
  console.log(payload);
  const onboardResult = webGjallarhorn.onboardSubscriber(payload);
  return onboardResult;
}

if (import.meta.main) {
  Deno.serve({ handler, port: 1234 });
}
