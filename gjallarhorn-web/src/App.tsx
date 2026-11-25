import { useEffect, useState } from "react";
import "./App.css";

const SUBSCRIBE_URL = "/api/web-subscribe";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Uint8Array.from(
        atob(padded),
        (character) => character.charCodeAt(0),
    );
}

function isPushSupported() {
    return (
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

function getInitialPushState() {
    if (!isPushSupported()) {
        return {
            status:
                "Push notifications are not supported in this browser. On iPhone, add this site to your Home Screen and open it from there.",
            disabled: true,
        };
    }

    if (!VAPID_PUBLIC_KEY) {
        return {
            status: "Missing VITE_VAPID_PUBLIC_KEY. See the client .env file.",
            disabled: true,
        };
    }

    if (Notification.permission === "denied") {
        return {
            status:
                "Notifications are blocked. Allow them in your browser settings, then reload.",
            disabled: true,
        };
    }

    return { status: "", disabled: false };
}

function App() {
    const [initialPushState] = useState(getInitialPushState);
    const [status, setStatus] = useState(initialPushState.status);
    const [disabled, setDisabled] = useState(initialPushState.disabled);

    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .catch((error: unknown) => {
                    console.error("Service worker registration failed", error);
                });
        }

        if (!isPushSupported() || !VAPID_PUBLIC_KEY) return;

        let active = true;
        const showCurrentState = async () => {
            if (!active) return;

            if (Notification.permission === "denied") {
                setDisabled(true);
                setStatus(
                    "Notifications are blocked. Allow them in your browser settings, then reload.",
                );
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            if (active && (await registration.pushManager.getSubscription())) {
                setStatus(
                    "This device already has a subscription. Tap to register it with the server again.",
                );
            }
        };

        showCurrentState().catch((error: unknown) => {
            console.error("Could not read push subscription state", error);
        });

        return () => {
            active = false;
        };
    }, []);

    async function subscribe() {
        console.log("%c⧭", "color: #ff0000", VAPID_PUBLIC_KEY);
        if (!VAPID_PUBLIC_KEY) {
            setDisabled(true);
            setStatus(
                "Missing VITE_VAPID_PUBLIC_KEY. See the client .env file.",
            );
            return;
        }

        setDisabled(true);
        setStatus("Subscribing…");

        try {
            // Must be the first await so the browser still sees the user's tap.
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                throw new Error("notification permission was not granted.");
            }

            const registration = await navigator.serviceWorker.ready;
            const applicationServerKey = base64UrlToBytes(VAPID_PUBLIC_KEY);
            const subscription =
                (await registration.pushManager.getSubscription()) ??
                    (await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey,
                    }));

            const response = await fetch(SUBSCRIBE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subscription),
            });
            if (!response.ok) {
                throw new Error(`server responded with ${response.status}.`);
            }

            const payload: unknown = await response.json();
            if (
                typeof payload !== "object" ||
                payload === null ||
                !("message" in payload) ||
                !payload.message
            ) {
                throw new Error("server could not register the subscription.");
            }

            setStatus(
                "Subscribed. This device will receive Gjallarhorn alerts.",
            );
        } catch (error) {
            setStatus(
                `Subscription failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        } finally {
            if (Notification.permission !== "denied") {
                setDisabled(false);
            }
        }

        console.log("%c⧭", "color: #ff0000", VAPID_PUBLIC_KEY);
        if (!VAPID_PUBLIC_KEY) {
            setDisabled(true);
            setStatus(
                "Missing VITE_VAPID_PUBLIC_KEY. See the client .env file.",
            );
            return;
        }

        setDisabled(true);
        setStatus("Subscribing…");

        try {
            // Must be the first await so the browser still sees the user's tap.
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                throw new Error("notification permission was not granted.");
            }

            const registration = await navigator.serviceWorker.ready;
            const applicationServerKey = base64UrlToBytes(VAPID_PUBLIC_KEY);
            const subscription =
                (await registration.pushManager.getSubscription()) ??
                    (await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey,
                    }));

            const response = await fetch(SUBSCRIBE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subscription),
            });
            if (!response.ok) {
                throw new Error(`server responded with ${response.status}.`);
            }

            const payload: unknown = await response.json();
            if (
                typeof payload !== "object" ||
                payload === null ||
                !("message" in payload) ||
                !payload.message
            ) {
                throw new Error("server could not register the subscription.");
            }

            setStatus(
                "Subscribed. This device will receive Gjallarhorn alerts.",
            );
        } catch (error) {
            setStatus(
                `Subscription failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        } finally {
            if (Notification.permission !== "denied") {
                setDisabled(false);
            }
        }
    }

    return (
        <section id="center">
            <div>
                <h1>Gjallarhorn</h1>
                <p>Get alerts on this device when the horn sounds.</p>
            </div>
            <button
                type="button"
                className="counter"
                onClick={() => subscribe()}
                disabled={disabled}
            >
                Subscribe to alerts
            </button>
            <p id="subscribe-status" role="status" aria-live="polite">
                {status}
            </p>
        </section>
    );
}

export default App;
