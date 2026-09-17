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
  hours: { total: 64.5, billable: 56, nonBillable: 8.5, billablePercent: 87 },
  standups: { submitted: 11, expected: 12, rate: 92 },
  projects: [
    {
      name: 'Checkout', client: 'Acme', billable: true, hours: 56, share: 87,
      contributors: [{ name: 'Asha', hours: 32 }, { name: 'Bela', hours: 24 }],
      notes: [], blockers: [{ name: 'Asha', blocker: 'API keys' }]
    },
    { name: 'Internal tooling', client: '', billable: false, hours: 8.5, share: 13, contributors: [{ name: 'Chirag', hours: 8.5 }], notes: [], blockers: [] }
  ],
  team: [{ name: 'Asha', hours: 32, standups: 4, projects: ['Checkout'] }],
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
  it('shows hours by project, billable share and open blockers', async () => {
    API.get.mockResolvedValue({ data: page() })

    show()

    expect(await screen.findByText('64.5h across 2 projects this week')).toBeInTheDocument()
    expect(screen.getByText('Billable · 56h')).toBeInTheDocument()
    expect(screen.getByText('Asha 32h · Bela 24h')).toBeInTheDocument()
    expect(screen.getByText('Non-billable')).toBeInTheDocument()
    expect(screen.getByText('Waiting on API keys')).toBeInTheDocument()
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

  it('goes back a week with the arrow', async () => {
    API.get.mockResolvedValue({ data: page() })

    show()
    await userEvent.click(await screen.findByRole('button', { name: 'Previous week' }))

    await waitFor(() =>
      expect(API.get).toHaveBeenLastCalledWith('/reports/weekly', { params: { week: '2026-09-07' } }))
  })
})
