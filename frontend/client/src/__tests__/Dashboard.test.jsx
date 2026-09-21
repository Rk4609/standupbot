import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import Dashboard from '../pages/Dashboard'

const user = { _id: 'u1', name: 'Asha Rao', role: 'employee', modules: ['dashboard', 'standup', 'attendance'] }

/** Thursday 17 September: a full Monday and Tuesday, nothing Wednesday, in since 10:00 today. */
const attendance = {
  today: '2026-09-17',
  policy: { start: '10:00', graceMinutes: 15, fullDayHours: 9, halfDayHours: 4 },
  todayRecord: { date: '2026-09-17', inAt: '10:00', outAt: null, minutes: null, state: 'working' },
  week: [
    { date: '2026-09-14', minutes: 510 },
    { date: '2026-09-15', minutes: 480 },
    { date: '2026-09-16', minutes: 0 },
    { date: '2026-09-17', minutes: 195 },
    { date: '2026-09-18', minutes: 0 },
    { date: '2026-09-19', minutes: 0 },
    { date: '2026-09-20', minutes: 0 }
  ]
}

const answers = {
  '/standups/my': [],
  '/users/profile': { name: 'Asha Rao', employment: {} },
  '/attendance/me': attendance,
  '/onboarding/mine': { onboarding: null },
  '/auth/2fa': { required: false, enabled: false }
}

const show = () => render(<MemoryRouter><Dashboard user={user} /></MemoryRouter>)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-17T13:15:00.000Z'))
  API.get.mockReset()
  // The side panels load their own data; left pending, they stay out of the way
  API.get.mockImplementation(url =>
    url in answers ? Promise.resolve({ data: answers[url] }) : new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the dashboard\'s hours', () => {
  it('come from attendance, today against the office\'s full day', async () => {
    show()

    expect(await screen.findByText('of 9h worked')).toBeInTheDocument()
    // The ring and today's bar both read 3¼ hours
    expect(screen.getAllByText('3.3h')).toHaveLength(2)
    // 8½ + 8 + 3¼ this week
    expect(screen.getAllByText(/^19\.8h?$/).length).toBeGreaterThan(0)

    expect(API.get).toHaveBeenCalledWith('/attendance/me')
    expect(API.get).not.toHaveBeenCalledWith('/timesheets/me')
  })

  it('shows today\'s check-in where the timesheet used to be', async () => {
    show()

    await userEvent.click(await screen.findByRole('button', { name: 'Attendance' }))

    expect(screen.getByText(/In at 10:00/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Timesheet' })).not.toBeInTheDocument()
  })
})
