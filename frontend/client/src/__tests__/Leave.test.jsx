import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import Leave from '../pages/Leave'
import LeaveApprovals from '../pages/LeaveApprovals'
import { dayRange, workingDays } from '../lib/leave'

const balance = (over = {}) => [
  { type: 'casual', allowance: 12, used: 3, pending: 1, remaining: 8 },
  { type: 'sick', allowance: 8, used: 7, pending: 0, remaining: 1 },
  { type: 'earned', allowance: 15, used: 0, pending: 0, remaining: 15 },
  { type: 'unpaid', allowance: null, used: 2, pending: 0, remaining: null },
  ...(over.extra || [])
]

const request = (over = {}) => ({
  _id: 'l1',
  userName: 'Ira Menon',
  type: 'casual',
  from: '2026-09-21',
  to: '2026-09-22',
  halfDay: false,
  days: 2,
  reason: 'Sister\'s wedding',
  status: 'pending',
  ...over
})

const calendar = (entries = []) => ({
  month: '2026-09',
  first: '2026-09-01',
  last: '2026-09-30',
  today: '2026-09-17',
  entries
})

/** Answer each GET by its path, the way the page asks. */
const serve = ({ mine, team, cal = calendar() }) => {
  API.get.mockImplementation((url) => {
    if (url === '/leave/mine') return Promise.resolve({ data: mine })
    if (url === '/leave/team') return Promise.resolve({ data: team })
    if (url === '/leave/calendar') return Promise.resolve({ data: cal })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

const mine = (over = {}) => ({
  year: 2026,
  today: '2026-09-17',
  requests: [request()],
  balance: balance(),
  types: ['casual', 'sick', 'earned', 'unpaid'],
  ...over
})

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('counting the days on the client', () => {
  it('matches the server: weekends are free, a half day is half', () => {
    // Friday the 18th to Monday the 21st
    expect(workingDays('2026-09-18', '2026-09-21')).toBe(2)
    expect(workingDays('2026-09-18', '2026-09-18', true)).toBe(0.5)
    expect(workingDays('2026-09-19', '2026-09-20')).toBe(0)
  })

  it('writes a range the short way', () => {
    expect(dayRange('2026-09-21', '2026-09-21')).not.toMatch(/–/)
    const range = dayRange('2026-09-21', '2026-09-24')
    expect(range).toMatch(/21/)
    expect(range).toMatch(/24/)
    // One month name, not one per end
    expect(range.match(/Sep/g)).toHaveLength(1)
  })
})

describe('my leave', () => {
  it('shows what is left of each kind and what I asked for', async () => {
    serve({ mine: mine() })

    render(<Leave />)

    expect(await screen.findByText('Your requests')).toBeInTheDocument()
    expect(screen.getByText('of 12 left')).toBeInTheDocument()
    expect(screen.getByText('Sister\'s wedding')).toBeInTheDocument()
    expect(screen.getByText('No limit')).toBeInTheDocument()
  })

  it('works out the cost as the dates are picked, and refuses more than is left', async () => {
    serve({ mine: mine() })

    render(<Leave />)
    await userEvent.click((await screen.findAllByRole('button', { name: /ask for leave/i }))[0])

    const dialog = within(screen.getByRole('dialog'))
    await userEvent.selectOptions(dialog.getByLabelText('Kind of leave'), 'sick')
    await userEvent.type(dialog.getByLabelText('First day'), '2026-09-21')
    await userEvent.clear(dialog.getByLabelText('Last day'))
    await userEvent.type(dialog.getByLabelText('Last day'), '2026-09-23')
    await userEvent.type(dialog.getByLabelText('Reason'), 'Fever')

    expect(dialog.getByText(/Only 1 day of sick leave left/)).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: /send request/i })).toBeDisabled()
  })

  it('sends a half day as one day, without a last day', async () => {
    serve({ mine: mine() })
    API.post.mockResolvedValue({ data: request() })

    render(<Leave />)
    await userEvent.click((await screen.findAllByRole('button', { name: /ask for leave/i }))[0])

    const dialog = within(screen.getByRole('dialog'))
    await userEvent.click(dialog.getByLabelText('Half a day'))
    await userEvent.type(dialog.getByLabelText('Day'), '2026-09-21')
    await userEvent.type(dialog.getByLabelText('Reason'), 'Dentist')

    expect(dialog.getByText(/Costs 0.5 days/)).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: /send request/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/leave', {
      type: 'casual', from: '2026-09-21', halfDay: true, reason: 'Dentist'
    }))
  })

  it('lets me cancel one still waiting, but not one already over', async () => {
    serve({
      mine: mine({
        requests: [
          request(),
          request({ _id: 'l2', from: '2026-08-03', to: '2026-08-04', status: 'approved', reason: 'Trip' })
        ]
      })
    })
    API.post.mockResolvedValue({ data: { message: 'Request cancelled' } })

    render(<Leave />)
    const cancels = await screen.findAllByRole('button', { name: 'Cancel' })

    expect(cancels).toHaveLength(1)
    await userEvent.click(cancels[0])
    expect(API.post).toHaveBeenCalledWith('/leave/l1/cancel', {})
  })

  it('shows who is away on the day I pick', async () => {
    serve({
      mine: mine(),
      cal: calendar([
        { _id: 'l9', userName: 'Kabir Sen', type: 'sick', from: '2026-09-17', to: '2026-09-17', status: 'approved' }
      ])
    })

    render(<Leave />)

    expect(await screen.findByText('Kabir Sen')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Friday, 18 Sept?/ }))
    expect(screen.getByText('Everybody is in.')).toBeInTheDocument()
  })
})

describe('answering leave', () => {
  const team = (over = {}) => ({
    requests: [request({ canDecide: true, balance: { allowance: 12, used: 3, remaining: 8 } })],
    pendingCount: 1,
    away: [{ _id: 'a1', userName: 'Kabir Sen', type: 'sick', to: '2026-09-18' }],
    today: '2026-09-17',
    statuses: ['pending', 'approved', 'rejected', 'cancelled'],
    types: ['casual', 'sick', 'earned', 'unpaid'],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    ...over
  })

  it('shows who is out today and what each person has left', async () => {
    serve({ team: team() })

    render(<LeaveApprovals />)

    expect(await screen.findByText('1 request is waiting on you.')).toBeInTheDocument()
    expect(screen.getAllByText('Kabir Sen').length).toBeGreaterThan(0)
    expect(screen.getByText(/8 days left of 12/)).toBeInTheDocument()
  })

  it('approves in one tap', async () => {
    serve({ team: team() })
    API.post.mockResolvedValue({ data: { message: 'Approved' } })

    render(<LeaveApprovals />)
    await userEvent.click(await screen.findByRole('button', { name: /approve/i }))

    expect(API.post).toHaveBeenCalledWith('/leave/l1/approve', {})
  })

  it('asks why before rejecting', async () => {
    serve({ team: team() })
    API.post.mockResolvedValue({ data: { message: 'Rejected' } })

    render(<LeaveApprovals />)
    await userEvent.click(await screen.findByRole('button', { name: /reject/i }))

    const dialog = within(screen.getByRole('dialog'))
    const send = dialog.getByRole('button', { name: /^reject$/i })
    expect(send).toBeDisabled()

    await userEvent.type(dialog.getByLabelText('Why'), 'Release week')
    await userEvent.click(send)

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/leave/l1/reject', { note: 'Release week' }))
  })
})
