import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The sender address decides whether mail arrives at all, so it is worth a
 * test: Resend's sandbox accepts everything and returns a success id, but
 * only delivers to the account owner. Left as the default, the whole email
 * side of the product looks healthy and reaches nobody.
 */
/**
 * Every message that would have gone over the wire.
 *
 * Captured at fetch rather than by mocking the resend package: the service is
 * CommonJS and reaches for it with require, which a module mock does not
 * intercept. Watching the request also checks the thing that actually
 * matters — what Resend is asked to send.
 */
const sent = []

const stubResendApi = () => {
  vi.stubGlobal('fetch', async (url, options) => {
    if (String(url).includes('api.resend.com')) {
      sent.push(JSON.parse(options.body))
      return new Response(JSON.stringify({ id: 'test-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    throw new Error(`unexpected request to ${url}`)
  })
}

const sandboxWarnings = (warn) =>
  warn.mock.calls.flat().filter(arg => typeof arg === 'string' && arg.includes('EMAIL_FROM'))

let emailService

const load = async () => {
  vi.resetModules()
  emailService = await import('../services/emailService.js')
}

const originalEnv = { ...process.env }

beforeEach(async () => {
  delete process.env.EMAIL_FROM
  delete process.env.RESEND_API_KEY
  sent.length = 0
  stubResendApi()
  await load()
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the sender address', () => {
  it('falls back to the sandbox, and says that it has', async () => {
    expect(emailService.from()).toContain('onboarding@resend.dev')
    expect(emailService.usingSandbox()).toBe(true)
  })

  it('uses EMAIL_FROM once a domain is verified', async () => {
    process.env.EMAIL_FROM = 'StandupBot <standups@example.com>'
    await load()

    expect(emailService.from()).toBe('StandupBot <standups@example.com>')
    expect(emailService.usingSandbox()).toBe(false)
  })

  it('warns about the sandbox once, not once per message', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    await load()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await emailService.sendReminderEmail('someone@example.com', 'Someone')
    await emailService.sendReminderEmail('other@example.com', 'Other')

    expect(sandboxWarnings(warn)).toHaveLength(1)
  })

  it('says nothing when a real sender is configured', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM = 'StandupBot <standups@example.com>'
    await load()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await emailService.sendReminderEmail('someone@example.com', 'Someone')

    expect(sandboxWarnings(warn)).toHaveLength(0)
  })

  it('puts the configured sender on the message itself', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM = 'StandupBot <standups@example.com>'
    await load()

    await emailService.sendReminderEmail('someone@example.com', 'Someone')

    expect(sent).toHaveLength(1)
    expect(sent[0].from).toBe('StandupBot <standups@example.com>')
    expect(sent[0].to).toEqual(['someone@example.com'])
  })
})

describe('without an API key', () => {
  it('skips quietly instead of taking the caller down', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // A cron job that throws here would stop every later reminder in the round
    await expect(
      emailService.sendReminderEmail('someone@example.com', 'Someone')
    ).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalled()
  })
})
