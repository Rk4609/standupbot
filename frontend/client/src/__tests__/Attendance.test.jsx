import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import Attendance from '../pages/Attendance'
import TeamAttendance from '../pages/TeamAttendance'
import { duration } from '../lib/attendance'

/** The page links to Profile, so it needs a router around it. */
const renderMine = () => render(<MemoryRouter><Attendance /></MemoryRouter>)

const policy = { start: '10:00', graceMinutes: 15, fullDayHours: 8, halfDayHours: 4 }

const record = (over = {}) => ({
  _id: 'a1',
  date: '2026-09-17',
  checkIn: '2026-09-17T04:25:00.000Z',
  checkOut: null,
  inAt: '09:55',
  outAt: null,
  minutes: null,
  late: false,
  lateBy: 0,
  state: 'working',
  ...over
})

/** September, with the 14th present, the 15th late and the 16th missed. */
const month = (over = {}) => ({
  month: '2026-09',
  today: '2026-09-17',
  timezone: 'Asia/Kolkata',
  timezoneSet: true,
  policy,
  todayRecord: null,
  todayLeave: null,
  days: Array.from({ length: 30 }, (_, i) => {
    const date = `2026-09-${String(i + 1).padStart(2, '0')}`
    const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
    if (date === '2026-09-14') return { date, weekend, state: 'present', record: record({ date, minutes: 512, outAt: '18:30', state: 'present' }), leave: null }
    if (date === '2026-09-15') return { date, weekend, state: 'present', record: record({ date, inAt: '10:45', late: true, lateBy: 30, minutes: 495, outAt: '19:00', state: 'present' }), leave: null }
    if (date === '2026-09-16') return { date, weekend, state: 'absent', record: null, leave: null }
    return { date, weekend, state: weekend ? 'weekend' : date > '2026-09-17' ? 'upcoming' : date === '2026-09-17' ? 'not-in' : 'untracked', record: null, leave: null }
  }),
  summary: { present: 2, late: 1, halfDays: 0, noCheckout: 0, absent: 1, leaveDays: 1.5, averageMinutes: 504, onTime: 50 },
  ...over
})

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('my attendance', () => {
  it('offers to check in, and says when the office starts', async () => {
    API.get.mockResolvedValue({ data: month() })

    renderMine()

    expect(await screen.findByRole('button', { name: /check in/i })).toBeInTheDocument()
    expect(screen.getByText(/Office starts at 10:00, with 15 minutes' grace/)).toBeInTheDocument()
  })

  it('checks in with one tap and shows the new state', async () => {
    API.get
      .mockResolvedValueOnce({ data: month() })
      .mockResolvedValue({ data: month({ todayRecord: record() }) })
    API.post.mockResolvedValue({ data: { message: 'Checked in at 09:55', record: record() } })

    renderMine()
    await userEvent.click(await screen.findByRole('button', { name: /check in/i }))

    expect(API.post).toHaveBeenCalledWith('/attendance/check-in', {})
    expect(await screen.findByRole('button', { name: /check out/i })).toBeInTheDocument()
    expect(screen.getByText(/In since 09:55/)).toBeInTheDocument()
  })

  it('says how late, and stops offering a button once the day is done', async () => {
    API.get.mockResolvedValue({
      data: month({
        todayRecord: record({ inAt: '10:40', late: true, lateBy: 25, checkOut: '2026-09-17T13:00:00.000Z', outAt: '18:30', minutes: 470, state: 'present' })
      })
    })

    renderMine()

    expect(await screen.findByText('25 min late')).toBeInTheDocument()
    expect(screen.getByText(/Checked out at 18:30 · 7h 50m today/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check (in|out)/i })).not.toBeInTheDocument()
  })

  it('does not offer check-in on a day of leave', async () => {
    API.get.mockResolvedValue({ data: month({ todayLeave: { type: 'casual', halfDay: false } }) })

    renderMine()

    expect(await screen.findByText(/on leave today/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check in/i })).not.toBeInTheDocument()
  })

  it('shows the month, and what happened on a day when it is tapped', async () => {
    API.get.mockResolvedValue({ data: month() })

    renderMine()
    await userEvent.click(await screen.findByRole('button', { name: /Tuesday, 15 Sept?, Present/ }))

    expect(screen.getByText('+30m')).toBeInTheDocument()
    // Once on the day's cell, once in the detail under the month
    expect(screen.getAllByText('8h 15m')).toHaveLength(2)
    // Half days of leave are not rounded away
    expect(screen.getByText('1.5')).toBeInTheDocument()
  })

  it('says the times are UTC until a timezone is chosen', async () => {
    API.get.mockResolvedValue({ data: month({ timezone: 'UTC', timezoneSet: false }) })

    renderMine()

    expect(await screen.findByRole('link', { name: /set your timezone/i })).toHaveAttribute('href', '/profile')
  })

  it('writes hours the short way', () => {
    expect(duration(510)).toBe('8h 30m')
    expect(duration(45)).toBe('45m')
    expect(duration(null)).toBe('—')
  })
})

describe('team attendance', () => {
  const person = (name, over = {}) => ({
    user: { _id: name, name, position: 'Engineer', team: 'Demo squad', avatar: '' },
    state: 'working',
    record: record(),
    leave: null,
    month: { present: 12, late: 1, absent: 0 },
    ...over
  })

  const day = (over = {}) => ({
    date: '2026-09-16',
    today: '2026-09-17',
    policy,
    teams: [{ _id: 't1', name: 'Demo squad' }],
    people: [
      person('Asha Rao', { state: 'present', record: record({ minutes: 510, outAt: '18:25', state: 'present' }) }),
      person('Kabir Sen', { state: 'no-checkout', record: record({ inAt: '10:50', late: true, lateBy: 35, state: 'no-checkout' }) }),
      person('Meera Joshi', { state: 'absent', record: null }),
      person('Ira Menon', { state: 'leave', record: null, leave: { type: 'sick', halfDay: false, to: '2026-09-18' } })
    ],
    counts: { total: 4, in: 0, done: 2, late: 1, leave: 1, missing: 1 },
    ...over
  })

  it('filters to the people who came in late', async () => {
    API.get.mockResolvedValue({ data: day() })

    render(<TeamAttendance />)
    await userEvent.click(await screen.findByRole('tab', { name: /Late/ }))

    expect(screen.getByText('Kabir Sen')).toBeInTheDocument()
    expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument()
  })

  it('corrects a forgotten check-out, with a reason', async () => {
    API.get.mockResolvedValue({ data: day() })
    API.post.mockResolvedValue({ data: { message: 'Updated' } })

    render(<TeamAttendance />)
    await userEvent.click(await screen.findByRole('button', { name: 'Correct Kabir Sen' }))

    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText('Checked out'), '18:40')
    const save = dialog.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()

    await userEvent.type(dialog.getByLabelText('Reason'), 'Forgot to check out')
    await userEvent.click(save)

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/attendance/correct', {
      user: 'Kabir Sen', date: '2026-09-16', checkIn: '10:50', checkOut: '18:40', reason: 'Forgot to check out'
    }))
  })

  it('asks for the day before when the arrow is pressed', async () => {
    API.get.mockResolvedValue({ data: day() })

    render(<TeamAttendance />)
    await userEvent.click(await screen.findByRole('button', { name: 'Previous day' }))

    await waitFor(() =>
      expect(API.get).toHaveBeenLastCalledWith('/attendance/team', { params: { date: '2026-09-15' } }))
  })
})
