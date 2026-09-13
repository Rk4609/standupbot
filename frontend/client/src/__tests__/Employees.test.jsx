import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))

import API from '../api/axios'
import Employees from '../pages/Employees'

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

    render(<Employees />)
    await openRow()

    expect(await screen.findByText('+91 98765 43210')).toBeInTheDocument()
    expect(screen.getByText(/12 Park Lane, Jaipur, RJ, 302001, India/)).toBeInTheDocument()
    expect(screen.getByText('12 Apr 1995')).toBeInTheDocument()
  })

  it('shows what they do here, with the date their probation runs out', async () => {
    answer()

    render(<Employees />)
    await openRow()

    expect(await screen.findByText('Frontend engineer')).toBeInTheDocument()
    expect(screen.getByText('EMP-014')).toBeInTheDocument()
    expect(screen.getByText(/On probation/)).toBeInTheDocument()
    expect(screen.getByText(/until 23 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText(/23 May 2026/)).toBeInTheDocument()
    expect(screen.getByText('4.1 years')).toBeInTheDocument()
  })

  it('no longer repeats the blockers board one person at a time', async () => {
    answer()

    render(<Employees />)
    await openRow()

    await screen.findByText('Frontend engineer')
    expect(screen.queryByText('Recent standups')).not.toBeInTheDocument()
  })

  it('shows pay to a reader whose role includes it', async () => {
    answer()

    render(<Employees />)
    await openRow()

    const formatted = (1270000).toLocaleString()
    expect(await screen.findByText(`INR ${formatted} / year`)).toBeInTheDocument()
  })

  it('says nothing about pay to a reader whose role does not', async () => {
    // The server leaves the field out entirely for this reader
    const user = detail().user
    delete user.salary
    answer({ user, moodBreakdown: {}, maySeePay: false })

    render(<Employees />)
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

    render(<Employees />)
    await openRow()

    await screen.findByText('Frontend engineer')
    expect(screen.queryByText('Department')).not.toBeInTheDocument()
    expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  })
})
