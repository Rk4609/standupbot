import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
}))

import API from '../api/axios'
import Support from '../pages/Support'

const CATEGORIES = ['bug', 'question', 'access', 'other']

const ticket = (over = {}) => ({
  _id: 't1',
  subject: 'The export button does nothing',
  body: 'I click Export CSV on Analytics and no file arrives.',
  category: 'bug',
  status: 'open',
  userName: 'Asha Rao',
  createdAt: '2026-09-12T09:00:00.000Z',
  replies: [],
  ...over
})

const queue = (tickets, over = {}) => ({
  tickets,
  openCount: tickets.filter(t => t.status === 'open').length,
  statuses: ['open', 'answered', 'closed'],
  categories: CATEGORIES,
  pageSizes: [10, 20, 50],
  total: tickets.length,
  page: 1,
  limit: 20,
  totalPages: 1,
  ...over
})

const answer = ({ mine = [], all = [] }) => {
  API.get.mockImplementation(url =>
    url.startsWith('/support/mine')
      ? Promise.resolve({ data: { tickets: mine, categories: CATEGORIES } })
      : Promise.resolve({ data: queue(all) })
  )
}

const employee = { role: 'employee', name: 'Asha Rao' }
const admin = { role: 'admin', name: 'The Admin' }

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
})

describe('reporting something', () => {
  it('tells somebody with nothing reported what the page is for', async () => {
    answer({ mine: [] })

    render(<Support user={employee} />)

    expect(await screen.findByText(/have not reported anything/i)).toBeInTheDocument()
  })

  it('sends what was typed, then shows it in their list', async () => {
    answer({ mine: [] })
    API.post.mockResolvedValue({ data: ticket() })

    render(<Support user={employee} />)
    await screen.findByText(/have not reported anything/i)

    await userEvent.click(screen.getAllByRole('button', { name: /report an issue/i })[0])
    await userEvent.type(screen.getByLabelText('In one line'), 'Export does nothing')
    await userEvent.type(screen.getByLabelText('What happened'), 'No file arrives at all.')

    answer({ mine: [ticket({ subject: 'Export does nothing' })] })
    await userEvent.click(screen.getByRole('button', { name: /send it/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/support', {
      subject: 'Export does nothing',
      body: 'No file arrives at all.',
      category: 'bug'
    }))

    expect(await screen.findByText('Export does nothing')).toBeInTheDocument()
  })

  it('does not send an empty report', async () => {
    answer({ mine: [] })

    render(<Support user={employee} />)
    await screen.findByText(/have not reported anything/i)
    await userEvent.click(screen.getAllByRole('button', { name: /report an issue/i })[0])

    expect(screen.getByRole('button', { name: /send it/i })).toBeDisabled()
  })
})

describe('the queue', () => {
  it('is not offered to somebody who cannot read it', async () => {
    answer({ mine: [ticket()] })

    render(<Support user={employee} />)
    await screen.findByText('The export button does nothing')

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(API.get).not.toHaveBeenCalledWith(expect.stringMatching(/^\/support\?/))
  })

  it('shows an admin who raised what, and how many are waiting', async () => {
    answer({
      mine: [],
      all: [ticket(), ticket({ _id: 't2', subject: 'Cannot see the team page', userName: 'Rohit' })]
    })

    render(<Support user={admin} />)

    expect(await screen.findByText(/2 people are waiting/i)).toBeInTheDocument()
    const list = within(screen.getByRole('list'))
    expect(list.getByText(/Asha Rao/)).toBeInTheDocument()
    expect(list.getByText(/Rohit/)).toBeInTheDocument()
  })

  it('opens a report to its whole thread', async () => {
    answer({
      mine: [],
      all: [ticket({
        status: 'answered',
        replies: [{
          _id: 'r1',
          authorName: 'The Admin',
          authorRole: 'admin',
          body: 'It needed a newer browser.',
          createdAt: '2026-09-12T10:00:00.000Z'
        }]
      })]
    })

    render(<Support user={admin} />)
    await userEvent.click(await screen.findByRole('button', { name: /export button/i }))

    expect(screen.getByText('It needed a newer browser.')).toBeInTheDocument()
    expect(screen.getByText(/I click Export CSV/)).toBeInTheDocument()
  })

  it('answers one, and says so without a reload', async () => {
    answer({ mine: [], all: [ticket()] })
    API.post.mockResolvedValue({
      data: ticket({
        status: 'answered',
        replies: [{
          _id: 'r1',
          authorName: 'The Admin',
          authorRole: 'admin',
          body: 'Fixed — try again.',
          createdAt: '2026-09-12T10:00:00.000Z'
        }]
      })
    })

    render(<Support user={admin} />)
    await userEvent.click(await screen.findByRole('button', { name: /export button/i }))
    await userEvent.type(screen.getByLabelText(/reply to/i), 'Fixed — try again.')
    await userEvent.click(screen.getByRole('button', { name: /send answer/i }))

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/support/t1/reply', { body: 'Fixed — try again.' })
    )
    // Scoped to the list: 'Answered' is also one of the filter's options
    const list = within(screen.getAllByRole('list')[0])
    await waitFor(() => expect(list.getByText('Answered')).toBeInTheDocument())
  })

  it('offers no reply box on something closed, only a way back', async () => {
    answer({ mine: [], all: [ticket({ status: 'closed' })] })

    render(<Support user={admin} />)
    await userEvent.click(await screen.findByRole('button', { name: /export button/i }))

    expect(screen.queryByLabelText(/reply to/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument()
  })

  it('filters by status through the server, not in the page', async () => {
    answer({ mine: [], all: [ticket()] })

    render(<Support user={admin} />)
    await screen.findByText(/1 person is waiting/i)

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'closed')

    await waitFor(() =>
      expect(API.get).toHaveBeenCalledWith(expect.stringContaining('status=closed'))
    )
  })
})
