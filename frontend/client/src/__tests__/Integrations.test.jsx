import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }
}))

import API from '../api/axios'
import Integrations from '../pages/Integrations'

const connected = {
  connected: true,
  webhook: 'https://hooks.slack.com/services/…3456',
  channel: '#standups',
  events: {
    standupSubmitted: false,
    blockerRaised: true,
    dailySummary: true,
    weeklyRetro: true
  },
  active: true,
  lastDeliveryAt: '2026-09-12T17:30:00.000Z',
  lastError: ''
}

const notConnected = { connected: false, events: null }

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
  API.get.mockResolvedValue({ data: notConnected })
})

describe('when nothing is connected', () => {
  it('explains where to get a webhook', async () => {
    render(<Integrations />)

    expect(await screen.findByText('How to get a webhook')).toBeInTheDocument()
    expect(screen.getByText('Not connected')).toBeInTheDocument()
  })

  it('says nothing is saved until Slack accepts it', async () => {
    render(<Integrations />)

    expect(
      await screen.findByText('Nothing is saved until Slack accepts the webhook.')
    ).toBeInTheDocument()
  })

  it('will not submit an empty webhook', async () => {
    render(<Integrations />)
    await screen.findByText('How to get a webhook')

    expect(screen.getByRole('button', { name: /connect and send/i })).toBeDisabled()
  })

  it('sends the webhook and shows the connected state', async () => {
    const user = userEvent.setup()
    API.put.mockResolvedValue({ data: { ...connected, message: 'Connected — check the channel' } })

    render(<Integrations />)
    await screen.findByText('How to get a webhook')

    await user.type(
      screen.getByLabelText('Webhook URL'),
      'https://hooks.slack.com/services/T1/B1/secret'
    )
    await user.type(screen.getByLabelText('Channel name'), '#standups')
    await user.click(screen.getByRole('button', { name: /connect and send/i }))

    await waitFor(() =>
      expect(API.put).toHaveBeenCalledWith('/slack', {
        webhookUrl: 'https://hooks.slack.com/services/T1/B1/secret',
        channel: '#standups'
      })
    )
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('keeps the form up when Slack rejects the webhook', async () => {
    const user = userEvent.setup()
    API.put.mockRejectedValue({ response: { data: { message: 'Slack would not accept that' } } })

    render(<Integrations />)
    await screen.findByText('How to get a webhook')

    await user.type(screen.getByLabelText('Webhook URL'), 'https://hooks.slack.com/services/x/y/z')
    await user.click(screen.getByRole('button', { name: /connect and send/i }))

    await waitFor(() => expect(API.put).toHaveBeenCalled())
    expect(screen.getByText('How to get a webhook')).toBeInTheDocument()
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })
})

describe('when a channel is connected', () => {
  beforeEach(() => {
    API.get.mockResolvedValue({ data: connected })
  })

  it('shows the channel and the masked webhook, never the secret', async () => {
    render(<Integrations />)

    expect(await screen.findByText('#standups')).toBeInTheDocument()
    expect(screen.getByText('https://hooks.slack.com/services/…3456')).toBeInTheDocument()
  })

  it('reflects which events are on', async () => {
    render(<Integrations />)
    await screen.findByText('#standups')

    expect(screen.getByLabelText('Each standup as it is posted')).not.toBeChecked()
    expect(screen.getByLabelText('Blockers, the moment they appear')).toBeChecked()
  })

  it('saves a toggle', async () => {
    const user = userEvent.setup()
    API.patch.mockResolvedValue({
      data: { ...connected, events: { ...connected.events, dailySummary: false } }
    })

    render(<Integrations />)
    await screen.findByText('#standups')

    await user.click(screen.getByLabelText('The end-of-day digest'))

    await waitFor(() =>
      expect(API.patch).toHaveBeenCalledWith('/slack', { events: { dailySummary: false } })
    )
  })

  it('puts a toggle back when the save fails', async () => {
    const user = userEvent.setup()
    API.patch.mockRejectedValue({ response: { data: { message: 'nope' } } })

    render(<Integrations />)
    await screen.findByText('#standups')

    const box = screen.getByLabelText('The end-of-day digest')
    await user.click(box)

    // Showing it off while the server still has it on would be a lie
    await waitFor(() => expect(box).toBeChecked())
  })

  it('surfaces the last delivery failure', async () => {
    API.get.mockResolvedValue({
      data: { ...connected, lastError: 'Slack said 404: channel_not_found' }
    })

    render(<Integrations />)

    expect(await screen.findByText('The last message did not get through')).toBeInTheDocument()
    expect(screen.getByText('Slack said 404: channel_not_found')).toBeInTheDocument()
  })

  it('sends a test message', async () => {
    const user = userEvent.setup()
    API.post.mockResolvedValue({ data: { message: 'Sent — check the channel' } })

    render(<Integrations />)
    await screen.findByText('#standups')

    await user.click(screen.getByRole('button', { name: /send a test/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/slack/test', {}))
  })

  it('disconnects back to the empty state', async () => {
    const user = userEvent.setup()
    API.delete.mockResolvedValue({ data: notConnected })

    render(<Integrations />)
    await screen.findByText('#standups')

    await user.click(screen.getByRole('button', { name: /disconnect/i }))

    expect(await screen.findByText('How to get a webhook')).toBeInTheDocument()
  })
})
