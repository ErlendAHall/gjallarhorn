const SUBSCRIBE_URL = '/api/web-subscribe'
const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function setupSubscribeButton(button: HTMLButtonElement, status: HTMLElement) {
  const setStatus = (message: string) => {
    status.textContent = message
  }

  if (!isPushSupported()) {
    button.disabled = true
    setStatus('Push notifications are not supported in this browser. On iPhone, add this site to your Home Screen and open it from there.')
    return
  }

  if (!VAPID_PUBLIC_KEY) {
    button.disabled = true
    setStatus('Missing VITE_VAPID_PUBLIC_KEY. See the client .env file.')
    return
  }
  const applicationServerKey = base64UrlToBytes(VAPID_PUBLIC_KEY)

  const showCurrentState = async () => {
    if (Notification.permission === 'denied') {
      button.disabled = true
      setStatus('Notifications are blocked. Allow them in your browser settings, then reload.')
      return
    }
    const registration = await navigator.serviceWorker.ready
    if (await registration.pushManager.getSubscription()) {
      setStatus('This device already has a subscription. Tap to register it with the server again.')
    }
  }

  const subscribe = async () => {
    button.disabled = true
    setStatus('Subscribing…')
    try {
      // Must be the first await so the browser still sees the user's tap.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('notification permission was not granted.')
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })

      const response = await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) {
        throw new Error(`server responded with ${response.status}.`)
      }
      const { message } = await response.json()
      if (!message) {
        throw new Error('server could not register the subscription.')
      }

      setStatus('Subscribed. This device will receive Gjallarhorn alerts.')
    } catch (err) {
      setStatus(`Subscription failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (Notification.permission !== 'denied') {
        button.disabled = false
      }
    }
  }

  button.addEventListener('click', subscribe)
  showCurrentState().catch((err) => console.error('Could not read push subscription state', err))
}
