import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import PushSettings from '../components/PushSettings'
import { keyBytes } from '../lib/push'

/** A browser that can do push, with a subscription we can watch. */
const browserWithPush = ({ permission = 'default', subscribed = false } = {}) => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true)
  }
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscribed ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription)
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) }
  })
  window.PushManager = function PushManager() {}
  window.Notification = { permission, requestPermission: vi.fn().mockResolvedValue('granted') }
  return { pushManager, subscription }
}

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

afterEach(() => {
  delete navigator.serviceWorker
  delete window.PushManager
  delete window.Notification
})

describe('the key', () => {
  it('turns a base64url key into bytes', () => {
    expect(Array.from(keyBytes('AQID_w'))).toEqual([1, 2, 3, 255])
  })
})

describe('notifications on this device', () => {
  it('turns on: asks permission, subscribes with the server key, and tells the server', async () => {
    const { pushManager } = browserWithPush()
    API.get.mockResolvedValue({ data: { enabled: true, publicKey: 'AQID_w', devices: [] } })
    API.post.mockResolvedValue({ data: {} })

    render(<PushSettings />)
    const toggle = await screen.findByRole('switch', { name: 'Notifications on this device' })
    await waitFor(() => expect(toggle).toBeEnabled())
    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(window.Notification.requestPermission).toHaveBeenCalled()
    expect(Array.from(pushManager.subscribe.mock.calls[0][0].applicationServerKey)).toEqual([1, 2, 3, 255])
    expect(API.post).toHaveBeenCalledWith('/push/subscribe', expect.objectContaining({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'p', auth: 'a' }
    }))
    expect(screen.getByRole('button', { name: 'Send a test' })).toBeInTheDocument()
  })

  it('turns off: unsubscribes here and on the server', async () => {
    const { subscription } = browserWithPush({ permission: 'granted', subscribed: true })
    API.get.mockResolvedValue({ data: { enabled: true, publicKey: 'AQID_w', devices: [{ _id: 'd1' }] } })
    API.post.mockResolvedValue({ data: {} })

    render(<PushSettings />)
    const toggle = await screen.findByRole('switch')
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    await userEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(API.post).toHaveBeenCalledWith('/push/unsubscribe', { endpoint: subscription.endpoint })
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })

  it('says when the server has no keys yet, and keeps the switch off', async () => {
    browserWithPush()
    API.get.mockResolvedValue({ data: { enabled: false, publicKey: null, devices: [] } })

    render(<PushSettings />)

    expect(await screen.findByText(/not set up on this server yet/)).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('says when the browser has blocked notifications', async () => {
    browserWithPush({ permission: 'denied' })
    API.get.mockResolvedValue({ data: { enabled: true, publicKey: 'AQID_w', devices: [] } })

    render(<PushSettings />)

    expect(await screen.findByText(/blocked for this site/)).toBeInTheDocument()
  })
})
