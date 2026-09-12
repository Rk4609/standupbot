import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import SlackIntegration from '../models/SlackIntegration.js'
import slack from '../services/slackService.js'
import { authHeader, joinTeam, makeTeam, makeUser } from './helpers.js'

let app
beforeAll(() => {
  app = createApp({ globalRateLimit: false })
})

const HOOK = 'https://hooks.slack.com/services/T00000000/B00000000/abcdef123456'

/** Stand in for Slack. Returns 200 unless a test says otherwise. */
const mockSlack = (impl) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    impl || (async () => new Response('ok', { status: 200 }))
  )

beforeEach(() => {
  mockSlack()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const withTeam = async () => {
  const manager = await makeUser({ role: 'manager' })
  const team = await makeTeam(manager, { name: `Team ${Date.now()}${Math.random()}` })
  const member = await joinTeam(await makeUser({ name: 'Team Member' }), team)
  return { manager, team, member }
}

const connect = (user, body = {}) =>
  request(app).put('/api/slack').set(...authHeader(user))
    .send({ webhookUrl: HOOK, channel: '#standups', ...body })

describe('isSlackWebhook', () => {
  it('accepts a real incoming webhook', () => {
    expect(slack.isSlackWebhook(HOOK)).toBe(true)
  })

  it('refuses anything that is not hooks.slack.com over https', () => {
    // The server POSTs to whatever is stored, so an arbitrary host would make
    // this an open proxy into the network the server sits in
    expect(slack.isSlackWebhook('http://hooks.slack.com/services/a/b/c')).toBe(false)
    expect(slack.isSlackWebhook('https://evil.example.com/services/a/b/c')).toBe(false)
    expect(slack.isSlackWebhook('https://hooks.slack.com.evil.com/services/a')).toBe(false)
    expect(slack.isSlackWebhook('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(slack.isSlackWebhook('https://hooks.slack.com/other/path')).toBe(false)
    expect(slack.isSlackWebhook('file:///etc/passwd')).toBe(false)
    expect(slack.isSlackWebhook('not a url')).toBe(false)
    expect(slack.isSlackWebhook('')).toBe(false)
  })
})

describe('connecting a channel', () => {
  it('proves the webhook works before storing it', async () => {
    const { manager } = await withTeam()

    const res = await connect(manager)

    expect(res.status).toBe(200)
    expect(res.body.connected).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(globalThis.fetch.mock.calls[0][0]).toBe(HOOK)
  })

  it('stores nothing when Slack rejects the webhook', async () => {
    const { manager, team } = await withTeam()
    mockSlack(async () => new Response('invalid_token', { status: 403 }))

    const res = await connect(manager)

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/invalid_token/)
    // A stored-but-broken webhook would leave the team believing they are
    // connected until the first standup quietly failed to appear
    expect(await SlackIntegration.findOne({ team: team._id })).toBeNull()
  })

  it('never returns the webhook itself', async () => {
    const { manager } = await withTeam()

    const res = await connect(manager)

    expect(JSON.stringify(res.body)).not.toContain('abcdef123456')
    expect(res.body.webhook).toMatch(/^https:\/\/hooks\.slack\.com\/services\/…/)
  })

  it('refuses a URL that is not a Slack webhook', async () => {
    const { manager } = await withTeam()

    const res = await connect(manager, { webhookUrl: 'https://evil.example.com/hook' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/hooks\.slack\.com/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('is closed to employees', async () => {
    const employee = await makeUser()
    const res = await connect(employee)
    expect(res.status).toBe(403)
  })

  it('will not let a manager wire up another team', async () => {
    const { manager } = await withTeam()
    const other = await withTeam()

    const res = await connect(manager, { team: String(other.team._id) })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/not yours/i)
  })
})

describe('what gets posted', () => {
  it('sends a standup when the team asked for it', async () => {
    const { manager, member } = await withTeam()
    await connect(manager, { events: { standupSubmitted: true } })
    globalThis.fetch.mockClear()

    await request(app).post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'Shipped the export', today: 'Start on Slack' })

    // The post is deliberately not awaited by the controller
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text).toMatch(/Team Member/)
    expect(JSON.stringify(body)).toContain('Start on Slack')
  })

  it('stays quiet when that event is switched off', async () => {
    const { manager, member } = await withTeam()
    await connect(manager, { events: { standupSubmitted: false, blockerRaised: false } })
    globalThis.fetch.mockClear()

    await request(app).post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b' })

    await new Promise(r => setTimeout(r, 100))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('raises a blocker separately, so it is not buried in the standup', async () => {
    const { manager, member } = await withTeam()
    await connect(manager, { events: { standupSubmitted: false, blockerRaised: true } })
    globalThis.fetch.mockClear()

    await request(app).post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b', blockers: 'Waiting on staging credentials' })

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    expect(body.text).toMatch(/is blocked/)
  })

  it('does not fail a standup when Slack is down', async () => {
    const { manager, member } = await withTeam()
    await connect(manager, { events: { standupSubmitted: true } })
    mockSlack(async () => {
      throw new Error('ECONNREFUSED')
    })

    const res = await request(app).post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b' })

    expect(res.status).toBe(201)
  })

  it('records the failure so the settings page can show it', async () => {
    const { manager, team } = await withTeam()
    await connect(manager)
    mockSlack(async () => new Response('channel_not_found', { status: 404 }))

    await slack.notifyTeam(team._id, 'dailySummary', { text: 'x' })

    const stored = await SlackIntegration.findOne({ team: team._id })
    expect(stored.lastError).toMatch(/channel_not_found/)
  })

  it('clears the last error once a message gets through', async () => {
    const { manager, team } = await withTeam()
    await connect(manager)
    await SlackIntegration.updateOne({ team: team._id }, { lastError: 'channel_not_found' })

    await slack.notifyTeam(team._id, 'dailySummary', { text: 'x' })

    const stored = await SlackIntegration.findOne({ team: team._id })
    expect(stored.lastError).toBe('')
    expect(stored.lastDeliveryAt).toBeTruthy()
  })

  it('posts nothing for a team with no channel connected', async () => {
    const { member } = await withTeam()
    globalThis.fetch.mockClear()

    await request(app).post('/api/standups').set(...authHeader(member))
      .send({ yesterday: 'a', today: 'b' })

    await new Promise(r => setTimeout(r, 100))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('gives up rather than hanging when Slack does not answer', async () => {
    mockSlack((url, opts) =>
      new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    )

    vi.useFakeTimers()
    const pending = slack.post(HOOK, { text: 'x' })
    await vi.advanceTimersByTimeAsync(6000)
    const result = await pending
    vi.useRealTimers()

    expect(result).toEqual({ ok: false, error: 'Slack did not respond in time' })
  })
})

describe('managing the connection', () => {
  it('turns an event off without touching the webhook', async () => {
    const { manager, team } = await withTeam()
    await connect(manager)

    const res = await request(app).patch('/api/slack').set(...authHeader(manager))
      .send({ events: { dailySummary: false } })

    expect(res.status).toBe(200)
    expect(res.body.events.dailySummary).toBe(false)
    expect(res.body.events.weeklyRetro).toBe(true)

    const stored = await SlackIntegration.findOne({ team: team._id })
    expect(stored.webhookUrl).toBe(HOOK)
  })

  it('can be paused entirely', async () => {
    const { manager, team } = await withTeam()
    await connect(manager)

    await request(app).patch('/api/slack').set(...authHeader(manager))
      .send({ active: false })

    const result = await slack.notifyTeam(team._id, 'dailySummary', { text: 'x' })
    expect(result.skipped).toBe('not connected')
  })

  it('sends a test message on demand', async () => {
    const { manager } = await withTeam()
    await connect(manager)
    globalThis.fetch.mockClear()

    const res = await request(app).post('/api/slack/test').set(...authHeader(manager)).send({})

    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledOnce()
  })

  it('reports a failed test rather than claiming success', async () => {
    const { manager } = await withTeam()
    await connect(manager)
    mockSlack(async () => new Response('no_service', { status: 404 }))

    const res = await request(app).post('/api/slack/test').set(...authHeader(manager)).send({})

    expect(res.status).toBe(502)
    expect(res.body.message).toMatch(/no_service/)
  })

  it('disconnects', async () => {
    const { manager, team } = await withTeam()
    await connect(manager)

    const res = await request(app).delete('/api/slack').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.connected).toBe(false)
    expect(await SlackIntegration.findOne({ team: team._id })).toBeNull()
  })

  it('says plainly when nothing is connected', async () => {
    const { manager } = await withTeam()

    const res = await request(app).get('/api/slack').set(...authHeader(manager))

    expect(res.status).toBe(200)
    expect(res.body.connected).toBe(false)
  })
})

describe('the messages themselves', () => {
  it('puts the plan and the blocker in a standup message', () => {
    const msg = slack.standupMessage(
      {
        yesterday: 'Shipped the export',
        today: 'Start on Slack',
        blockers: 'Waiting on credentials',
        hasBlocker: true,
        mood: 'good',
        date: '2026-09-12'
      },
      { name: 'Asha Rao' }
    )

    const text = msg.blocks[0].text.text
    expect(text).toContain('Asha Rao')
    expect(text).toContain('Shipped the export')
    expect(text).toContain('Start on Slack')
    expect(text).toContain('Waiting on credentials')
  })

  it('includes a team\'s own questions', () => {
    const msg = slack.standupMessage(
      {
        today: 'b',
        mood: 'good',
        date: '2026-09-12',
        answers: { what_i_learned: 'Maps serialise as objects' }
      },
      { name: 'Asha Rao' }
    )

    expect(msg.blocks[0].text.text).toContain('Maps serialise as objects')
  })

  it('trims a very long answer rather than letting Slack cut it', () => {
    const msg = slack.standupMessage(
      { today: 'x'.repeat(900), mood: 'good', date: '2026-09-12' },
      { name: 'Asha Rao' }
    )

    expect(msg.blocks[0].text.text).toContain('…')
    expect(msg.blocks[0].text.text.length).toBeLessThan(700)
  })

  it('says so when nobody posted', () => {
    const msg = slack.summaryMessage('Platform', '2026-09-12', [], 5)
    expect(msg.blocks[0].text.text).toContain('0 of 5')
  })

  it('names who is blocked in the daily summary', () => {
    const msg = slack.summaryMessage('Platform', '2026-09-12', [
      { hasBlocker: true, blockers: 'Staging is down', user: { name: 'Rohit' } },
      { hasBlocker: false, user: { name: 'Sara' } }
    ], 2)

    const text = msg.blocks[0].text.text
    expect(text).toContain('Rohit')
    expect(text).toContain('Staging is down')
    expect(text).not.toContain('Sara')
  })
})

describe('an admin without a team of their own', () => {
  it('resolves to a team instead of hitting a dead end', async () => {
    // Their own `team` is null, which used to return an error with no way
    // for the page to offer a choice
    const { team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app).get('/api/slack').set(...authHeader(admin))

    expect(res.status).toBe(200)
    expect(res.body.team).toBeTruthy()
    expect(res.body.teams.map(t => String(t._id))).toContain(String(team._id))
  })

  it('can wire up a team they name', async () => {
    const { team } = await withTeam()
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app).put('/api/slack').set(...authHeader(admin))
      .send({ webhookUrl: HOOK, team: String(team._id) })

    expect(res.status).toBe(200)
    const stored = await SlackIntegration.findOne({ team: team._id })
    expect(stored).toBeTruthy()
  })

  it('does not hand a manager the list of every team', async () => {
    await withTeam()
    const { manager } = await withTeam()

    const res = await request(app).get('/api/slack').set(...authHeader(manager))

    expect(res.body.teams).toEqual([])
  })
})

describe('a lead\'s own standup', () => {
  it('is filed against the team they run, not with no team at all', async () => {
    // A manager's own `team` field is empty — they are linked as the team's
    // manager instead — so reading it directly left their standup teamless
    const { manager, team } = await withTeam()

    const res = await request(app).post('/api/standups').set(...authHeader(manager))
      .send({ yesterday: 'a', today: 'b' })

    expect(res.status).toBe(201)
    expect(String(res.body.team)).toBe(String(team._id))
  })

  it('reaches the team channel', async () => {
    const { manager } = await withTeam()
    await connect(manager, { events: { standupSubmitted: true } })
    globalThis.fetch.mockClear()

    await request(app).post('/api/standups').set(...authHeader(manager))
      .send({ yesterday: 'a', today: 'Wired up Slack' })

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    expect(JSON.stringify(globalThis.fetch.mock.calls[0][1].body)).toContain('Wired up Slack')
  })

  it('leaves an admin who runs no team without one, rather than guessing', async () => {
    const admin = await makeUser({ role: 'admin' })

    const res = await request(app).post('/api/standups').set(...authHeader(admin))
      .send({ yesterday: 'a', today: 'b' })

    expect(res.status).toBe(201)
    expect(res.body.team).toBeNull()
  })
})
