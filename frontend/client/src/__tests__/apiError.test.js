import { describe, expect, it } from 'vitest'
import { apiErrorMessage } from '../lib/apiError'

/**
 * This decides what a user reads when something fails. Collapsing every case
 * to one generic line is what made a not-yet-deployed endpoint look identical
 * to an outage.
 */
describe('apiErrorMessage', () => {
  it('prefers the message the API sent', () => {
    const err = { response: { status: 400, data: { message: 'You are not part of any team!' } } }
    expect(apiErrorMessage(err)).toBe('You are not part of any team!')
  })

  it('explains a 404 as a missing endpoint rather than missing data', () => {
    expect(apiErrorMessage({ response: { status: 404, data: {} } }))
      .toMatch(/not on the server yet/i)
  })

  it('names an expired session on 401', () => {
    expect(apiErrorMessage({ response: { status: 401, data: {} } })).toMatch(/expired/i)
  })

  it('names a permission problem on 403', () => {
    expect(apiErrorMessage({ response: { status: 403, data: {} } })).toMatch(/access/i)
  })

  it('reports the status for a server error', () => {
    expect(apiErrorMessage({ response: { status: 503, data: {} } })).toContain('503')
  })

  it('distinguishes offline from an unreachable server', () => {
    const err = { request: {} }

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(apiErrorMessage(err)).toMatch(/offline/i)

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(apiErrorMessage(err)).toMatch(/could not reach/i)
  })

  it('falls back to the supplied text when there is nothing else', () => {
    expect(apiErrorMessage({}, 'Could not load employees')).toBe('Could not load employees')
  })
})
