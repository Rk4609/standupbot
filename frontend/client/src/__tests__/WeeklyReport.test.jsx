import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import WeeklyReport from '../pages/WeeklyReport'

const facts = (over = {}) => ({
  week: { start: '2026-09-14', end: '2026-09-18', label: 'Week 38 · Sep 14–18' },
  people: 3,
  standups: { submitted: 11, expected: 12, rate: 92 },
  blockersRaised: 2,
  team: [
    {
      name: 'Asha', standups: 4, blocked: 2,
      updates: [{ date: '2026-09-14', text: 'Build the payment form' }, { date: '2026-09-15', text: 'Wire up Razorpay' }]
    },
    { name: 'Bela', standups: 7, blocked: 0, updates: [{ date: '2026-09-14', text: 'Test the payment form' }] },
    { name: 'Chirag', standups: 0, blocked: 0, updates: [] }
  ],
  openBlockers: [{ name: 'Asha', blocker: 'Waiting on API keys', since: '2026-09-17' }],
  nextWeek: [],
  leave: { days: 0, people: [] },
  ...over
})

const page = (over = {}) => ({
  today: '2026-09-17',
  title: 'MERN',
  team: { _id: 't1', name: 'MERN' },
  teams: [{ _id: 't1', name: 'MERN' }],
  canSeeAll: false,
  isCurrentWeek: true,
  facts: facts(),
  report: null,
  aiAvailable: true,
  ...over
})

const show = () => render(<MemoryRouter><WeeklyReport /></MemoryRouter>)

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('the weekly report', () => {
  it('shows what each person worked on and the open blockers, with no hours', async () => {
    API.get.mockResolvedValue({ data: page() })

    show()

    expect(await screen.findByText('11 standups from 2 people this week')).toBeInTheDocument()
    expect(screen.getByText('Wire up Razorpay')).toBeInTheDocument()
    expect(screen.getByText('Test the payment form')).toBeInTheDocument()
    expect(screen.getByText('Waiting on API keys')).toBeInTheDocument()
    expect(screen.queryByText(/hours/i)).not.toBeInTheDocument()
  })

  it('writes the report for the week on screen, then offers the PDF', async () => {
    API.get.mockResolvedValue({ data: page() })
    API.post.mockResolvedValue({
      data: { report: { content: '**Summary**\nCheckout took most of the week.', generatedAt: '2026-09-17T11:00:00Z', generatedByName: 'Deepak' }, facts: facts() }
    })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})

    show()
    await userEvent.click(await screen.findByRole('button', { name: /write the report/i }))

    expect(API.post).toHaveBeenCalledWith('/reports/weekly', { week: '2026-09-14' })
    expect(await screen.findByText('Checkout took most of the week.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })

  it('marks what changed since last week', async () => {
    API.get.mockResolvedValue({ data: page({ lastWeek: { standupRate: 80, openBlockers: 3 } }) })

    show()

    // Fewer blockers is good news, a higher filing rate too
    expect(await screen.findByText(/↓\s*2/)).toHaveClass('text-emerald-600')
    expect(screen.getByText(/↑\s*12\s*%/)).toHaveClass('text-emerald-600')
  })

  it('goes back a week with the arrow', async () => {
    API.get.mockResolvedValue({ data: page() })

    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Previous week' }))

    await waitFor(() =>
      expect(API.get).toHaveBeenLastCalledWith('/reports/weekly', { params: { week: '2026-09-07' } }))
  })
})
