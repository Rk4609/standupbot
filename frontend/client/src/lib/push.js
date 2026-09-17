import API from '../api/axios'

/**
 * Turning notifications on and off for this browser or phone.
 *
 * The browser owns the subscription; the server keeps a copy so it knows
 * where to send. Both sides are changed together, and "is it on here" is
 * always read from the browser, which is the only one that knows for sure.
 */

/** Can this browser do push at all? iPhones only can from the installed app. */
export const pushSupport = () => {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const installed = window.matchMedia?.('(display-mode: standalone)').matches
    return iOS && !installed ? 'install-first' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  return 'supported'
}

/** The base64url VAPID key as the bytes the browser wants. */
export const keyBytes = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, ch => ch.charCodeAt(0))
}

const registration = () => navigator.serviceWorker.ready

/** A readable name for this device, so the profile can list it. */
const deviceName = () => {
  const ua = navigator.userAgent
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Browser'
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}

/** This browser's current subscription, or null. */
export const currentSubscription = async () => {
  if (pushSupport() !== 'supported') return null
  const reg = await registration()
  return reg.pushManager.getSubscription()
}

/** Ask permission, subscribe, and tell the server. Throws with a readable message. */
export const enablePush = async (publicKey) => {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site. Allow them in the browser settings.'
      : 'Notifications were not allowed.')
  }

  const reg = await registration()
  const subscription = await reg.pushManager.getSubscription() ||
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })

  await API.post('/push/subscribe', { ...subscription.toJSON(), device: deviceName() })
  return subscription
}

/** Unsubscribe here and forget this device on the server. */
export const disablePush = async () => {
  const subscription = await currentSubscription()
  if (!subscription) return
  await API.post('/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {})
  await subscription.unsubscribe()
}
