/* global clients */
/**
 * Push handling, loaded into the service worker the PWA plugin generates.
 *
 * Shows what the server sent, and on a tap brings an open StandupBot window
 * to the page the notification is about — or opens one if none is open.
 * Kept to plain script: this runs outside the app bundle.
 */

self.addEventListener('push', (event) => {
  const read = () => {
    try {
      return event.data ? event.data.json() : {}
    } catch {
      return { body: event.data ? event.data.text() : '' }
    }
  }
  const data = read()

  const title = data.title || 'StandupBot'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // One of each kind at a time: a second leave update replaces the first
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(w => w.url.startsWith(self.location.origin))
    if (open) {
      await open.focus()
      if ('navigate' in open) return open.navigate(target)
      return undefined
    }
    return clients.openWindow(target)
  })())
})
