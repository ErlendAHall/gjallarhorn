import './style.css'
import { setupSubscribeButton } from './subscribe.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<section id="center">
  <div>
    <h1>Gjallarhorn</h1>
    <p>Get alerts on this device when the horn sounds.</p>
  </div>
  <button id="subscribe" type="button" class="counter">Subscribe to alerts</button>
  <p id="subscribe-status" role="status" aria-live="polite"></p>
</section>
`

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .catch((err) => console.error('Service worker registration failed', err))
}

setupSubscribeButton(
  document.querySelector<HTMLButtonElement>('#subscribe')!,
  document.querySelector<HTMLParagraphElement>('#subscribe-status')!,
)
