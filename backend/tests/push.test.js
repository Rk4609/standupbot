import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import webpush from 'web-push'
import { createApp } from '../app.js'
import PushSubscription from '../models/PushSubscription.js'
import { notify } from '../services/notifyService.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
let keys
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
  keys = webpush.generateVAPIDKeys()
})

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = keys.publicKey
  process.env.VAPID_PRIVATE_KEY = keys.privateKey
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
})

let seq = 0
const device = () => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/device-${++seq}`,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
  device: 'Chrome on Android'
})

const subscribe = (user, body = device()) =>
  request(app).post('/api/push/subscribe').set(...authHeader(user)).send(body)

/** Let the fire-and-forget push after a notification finish. */
const settle = () => new Promise(r => setTimeout(r, 50))

describe('turning it on', () => {
  it('hands out the public key, and says when push is not set up', async () => {
    const user = await makeUser()

    const on = await request(app).get('/api/push').set(...authHeader(user))
    delete process.env.VAPID_PUBLIC_KEY
    const off = await request(app).get('/api/push').set(...authHeader(user))

    expect(on.body).toMatchObject({ enabled: true, publicKey: keys.publicKey, devices: [] })
    expect(off.body).toMatchObject({ enabled: false, publicKey: null })
  })

  it('remembers a device, once, and forgets it when asked', async () => {
    const user = await makeUser()
    const phone = device()

    expect((await subscribe(user, phone)).status).toBe(201)
    await subscribe(user, phone)
    expect(await PushSubscription.countDocuments({ user: user._id })).toBe(1)

    await request(app).post('/api/push/unsubscribe').set(...authHeader(user)).send({ endpoint: phone.endpoint })
    expect(await PushSubscription.countDocuments()).toBe(0)
  })

  it('moves a device to whoever signs in on it next', async () => {
    const first = await makeUser()
    const second = await makeUser()
    const shared = device()

    await subscribe(first, shared)
    await subscribe(second, shared)

    const row = await PushSubscription.findOne({ endpoint: shared.endpoint }).lean()
    expect(String(row.user)).toBe(String(second._id))
  })

  it('refuses when push is not set up on the server', async () => {
    const user = await makeUser()
    delete process.env.VAPID_PRIVATE_KEY
    expect((await subscribe(user)).status).toBe(503)
  })
})

describe('sending', () => {
  it('pushes a stored notification to every device the person turned on', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201 })
    const user = await makeUser()
    await subscribe(user)
    await subscribe(user)

    await notify(null, { recipient: user._id, type: 'leave_decided', message: 'Your leave for 2026-09-21 was approved', link: '/leave' })
    await settle()

    expect(send).toHaveBeenCalledTimes(2)
    const payload = JSON.parse(send.mock.calls[0][1])
    expect(payload).toEqual({ title: 'Leave update', body: 'Your leave for 2026-09-21 was approved', url: '/leave', tag: 'leave_decided' })
  })

  it('does not buzz a phone for every standup a team files', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201 })
    const manager = await makeUser({ role: 'manager' })
    const team = await makeTeam(manager)
    const employee = await joinTeam(await makeUser(), team)
    await subscribe(manager)

    await request(app).post('/api/standups').set(...authHeader(employee)).send({ today: 'Shipping', blockers: 'Waiting on API keys' })
    await settle()

    // The blocker is pushed; the plain "submitted" is not
    const tags = send.mock.calls.map(c => JSON.parse(c[1]).tag)
    expect(tags).toEqual(['blocker_added'])
  })

  it('forgets a device the push service says is gone', async () => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }))
    const user = await makeUser()
    await subscribe(user)

    await notify(null, { recipient: user._id, type: 'payslip_ready', message: 'Your payslip is ready', link: '/payslips' })
    await settle()

    expect(await PushSubscription.countDocuments()).toBe(0)
  })

  it('still stores the notification when pushing fails', async () => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(Object.assign(new Error('Down'), { statusCode: 500 }))
    const user = await makeUser()
    await subscribe(user)

    const doc = await notify(null, { recipient: user._id, type: 'payslip_ready', message: 'Your payslip is ready', link: '/payslips' })
    await settle()

    expect(doc).not.toBeNull()
    expect(await PushSubscription.countDocuments()).toBe(1)
  })

  it('sends a test to the person\'s own devices', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201 })
    const user = await makeUser()

    expect((await request(app).post('/api/push/test').set(...authHeader(user))).status).toBe(404)
    await subscribe(user)
    const res = await request(app).post('/api/push/test').set(...authHeader(user))

    expect(res.status).toBe(200)
    expect(send).toHaveBeenCalledTimes(1)
  })
})
