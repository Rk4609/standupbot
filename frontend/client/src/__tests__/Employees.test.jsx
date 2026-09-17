import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))

import API from '../api/axios'
import Employees from '../pages/Employees'
import { prettyDate } from '../lib/dates'

// Dates are written in the reader's own locale. Asking the helper for the
// expected text keeps these tests true on any machine — hard-coding
// "12 Apr 1995" passed in an Indian locale and failed on GitHub's US one.
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const row = {
  _id: 'u1',
  name: 'Asha Rao',
  email: 'asha@acme.test',
  role: 'employee',
  avatar: '',
  team: { _id: 't1', name: 'MERN' },
  totalStandups: 22,
  blockerCount: 4,
  lastDate: '2026-09-12',
  weekDates: ['2026-09-10', '2026-09-11'],
  weekCount: 2,
  submittedToday: false
}

const list = {
  week: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'],
  employees: [row],
  maySeePay: true,
  teams: ['MERN'],
  pageSizes: [10, 20, 50, 100],
  total: 1,
  rosterTotal: 1,
  page: 1,
  limit: 20,
  totalPages: 1
}

const summary = { rosterTotal: 1, submittedToday: 0, withBlockers: 1, teamCount: 1 }

const detail = (over = {}) => ({
  user: {
    _id: 'u1',
    name: 'Asha Rao',
    email: 'asha@acme.test',
    phone: '+91 98765 43210',
    dob: '1995-04-12T00:00:00.000Z',
    address: { line1: '12 Park Lane', city: 'Jaipur', state: 'RJ', pincode: '302001', country: 'India' },
    team: { _id: 't1', name: 'MERN' },
    createdAt: '2024-01-04T00:00:00.000Z',
    employment: {
      employeeId: 'EMP-014',
      position: 'Frontend engineer',
      department: 'Engineering',
      type: 'probation',
      joinedOn: '2026-05-23T00:00:00.000Z',
      endsOn: '2026-11-23T00:00:00.000Z',
      experienceYears: 4.1
    },
    salary: { amount: 1270000, currency: 'INR', period: 'year', reviewedOn: '2026-08-11T00:00:00.000Z' }
  },
  moodBreakdown: { good: 6, okay: 4 },
  maySeePay: true,
  ...over
})

const answer = (one = detail()) => {
  API.get.mockImplementation(url => {
    if (url.startsWith('/employees/summary')) return Promise.resolve({ data: summary })
    if (url.startsWith('/employees/')) return Promise.resolve({ data: one })
    return Promise.resolve({ data: list })
  })
}

const openRow = async () => {
  const button = await screen.findByRole('button', { name: /Asha Rao/ })
  await userEvent.click(button)
}

beforeEach(() => {
  API.get.mockReset()
})

describe('opening somebody on the roster', () => {
  it('shows who they are and how to reach them', async () => {
    answer()

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    expect(await screen.findByText('+91 98765 43210')).toBeInTheDocument()
    expect(screen.getByText(/12 Park Lane, Jaipur, RJ, 302001, India/)).toBeInTheDocument()
    expect(screen.getByText(prettyDate('1995-04-12T00:00:00.000Z'))).toBeInTheDocument()
  })

  it('shows what they do here, with the date their probation runs out', async () => {
    answer()

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    expect(await screen.findByText('Frontend engineer')).toBeInTheDocument()
    expect(screen.getByText('EMP-014')).toBeInTheDocument()
    expect(screen.getByText(/On probation/)).toBeInTheDocument()
    expect(screen.getByText(`until ${prettyDate('2026-11-23T00:00:00.000Z')}`)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(escape(prettyDate('2026-05-23T00:00:00.000Z'))))
    ).toBeInTheDocument()
    expect(screen.getByText('4.1 years')).toBeInTheDocument()
  })

  it('no longer repeats the blockers board one person at a time', async () => {
    answer()

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    await screen.findByText('Frontend engineer')
    expect(screen.queryByText('Recent standups')).not.toBeInTheDocument()
  })

  it('shows pay to a reader whose role includes it', async () => {
    answer()

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    const formatted = (1270000).toLocaleString()
    expect(await screen.findByText(`INR ${formatted} / year`)).toBeInTheDocument()
  })

  it('says nothing about pay to a reader whose role does not', async () => {
    // The server leaves the field out entirely for this reader
    const user = detail().user
    delete user.salary
    answer({ user, moodBreakdown: {}, maySeePay: false })

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    await screen.findByText('Frontend engineer')
    expect(screen.queryByText('What they are paid')).not.toBeInTheDocument()
    expect(screen.queryByText(/INR/)).not.toBeInTheDocument()
  })

  it('leaves out a detail nobody has filled in', async () => {
    const one = detail()
    one.user.phone = ''
    one.user.employment.department = ''
    answer(one)

    render(<MemoryRouter><Employees /></MemoryRouter>)
    await openRow()

    await screen.findByText('Frontend engineer')
    expect(screen.queryByText('Department')).not.toBeInTheDocument()
    expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  })
})

describe('signs of strain', () => {
  const strained = {
    level: 'check-in',
    signals: [
      { kind: 'long-days', detail: '5 days over 9½ hours in two weeks' },
      { kind: 'no-break', detail: 'No leave in 140 days' }
    ]
  }

  const withWellbeing = (wellbeing) => {
    API.get.mockImplementation(url => {
      if (url.startsWith('/employees/summary')) return Promise.resolve({ data: summary })
      if (url.startsWith('/employees/')) return Promise.resolve({ data: detail() })
      return Promise.resolve({ data: { ...list, employees: [{ ...row, wellbeing }] } })
    })
  }

  it('marks somebody worth a check-in, and says why when they are opened', async () => {
    withWellbeing(strained)

    render(<MemoryRouter><Employees /></MemoryRouter>)

    expect(await screen.findByText('Check in')).toBeInTheDocument()
    await openRow()
    expect(screen.getByText('Worth a friendly check-in')).toBeInTheDocument()
    expect(screen.getByText(/5 days over 9½ hours in two weeks/)).toBeInTheDocument()
    expect(screen.getByText(/not a verdict/)).toBeInTheDocument()
  })

  it('does not mark a single sign on the list', async () => {
    withWellbeing({ level: 'watch', signals: [strained.signals[1]] })

    render(<MemoryRouter><Employees /></MemoryRouter>)

    await screen.findByRole('button', { name: /Asha Rao/ })
    expect(screen.queryByText('Check in')).not.toBeInTheDocument()
  })
})

describe('arriving from a search result', () => {
  it('searches for the name in the address', async () => {
    answer()

    render(<MemoryRouter initialEntries={['/employees?search=Asha%20Rao']}><Employees /></MemoryRouter>)

    expect(await screen.findByDisplayValue('Asha Rao')).toBeInTheDocument()
    await waitFor(() => expect(API.get).toHaveBeenCalledWith('/employees', expect.objectContaining({
      params: expect.objectContaining({ search: 'Asha Rao' })
    })))
  })
})
