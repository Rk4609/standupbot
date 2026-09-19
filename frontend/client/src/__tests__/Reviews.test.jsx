import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import API from '../api/axios'
import ReviewDetail from '../pages/ReviewDetail'
import OneOnOneDetail from '../pages/OneOnOneDetail'
import { orderMeetings } from '../lib/reviews'

const AREAS = ['quality', 'delivery', 'teamwork', 'ownership', 'communication']
const ratings = Object.fromEntries(AREAS.map(a => [a, 4]))

const review = (over = {}) => ({
  _id: 'r1',
  cycleName: 'H1 2026',
  from: '2026-01-01',
  to: '2026-06-30',
  employeeName: 'Asha',
  reviewerName: 'Ravi',
  status: 'self',
  self: { ratings: {}, wins: '', improve: '', submittedAt: null },
  manager: null,
  ...over
})

const at = (path, element, route) => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /></Routes></MemoryRouter>
)

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset()
})

describe('a review', () => {
  it('lets the employee hand in only once every area is rated', async () => {
    API.get.mockResolvedValue({ data: { review: { ...review(), viewer: 'employee' }, areas: AREAS } })
    API.put.mockResolvedValue({ data: { review: review({ status: 'manager', self: { ratings, submittedAt: 'x' } }) } })
    const user = userEvent.setup()
    at('/reviews/r1', <ReviewDetail />, '/reviews/:id')

    const handIn = await screen.findByRole('button', { name: 'Hand it in' })
    expect(handIn).toBeDisabled()
    for (const label of ['Quality of work', 'Delivers on time', 'Teamwork', 'Ownership', 'Communication']) {
      await user.click(screen.getByRole('button', { name: `${label}: 4` }))
    }
    await user.click(handIn)

    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/reviews/r1/self', expect.objectContaining({ ratings, submit: true })))
  })

  it('shows the manager what the record says and what they rated themselves', async () => {
    API.get.mockResolvedValue({
      data: {
        review: { ...review({ status: 'manager', self: { ratings, wins: 'Shipped payroll', improve: '', submittedAt: 'x' } }), viewer: 'reviewer' },
        areas: AREAS,
        facts: { standups: 88, blockers: 3, kudos: 5, leaveDays: 4, recentKudos: [{ from: 'Bela', message: 'Saved the release' }], moods: {} }
      }
    })
    at('/reviews/r1', <ReviewDetail />, '/reviews/:id')

    expect(await screen.findByText('88')).toBeInTheDocument()
    expect(screen.getByText('“Saved the release” — Bela')).toBeInTheDocument()
    expect(screen.getByText('Shipped payroll')).toBeInTheDocument()
    expect(screen.getAllByText('They said 4')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Share with Asha' })).toBeDisabled()
  })
})

describe('a 1:1', () => {
  const meeting = (over = {}) => ({
    _id: 'm1',
    managerName: 'Ravi',
    employeeName: 'Asha',
    date: '2026-09-22',
    time: '11:00',
    status: 'upcoming',
    notes: 'Talked growth',
    items: [{ _id: 'i1', kind: 'action', text: 'Write the design doc', by: 'manager', owner: 'employee', done: false, carried: true }],
    ...over
  })

  it('shows the employee the shared notes and lets them add a point, with no private note box', async () => {
    API.get.mockResolvedValue({ data: { oneOnOne: meeting({ side: 'employee' }) } })
    API.post.mockResolvedValue({ data: { oneOnOne: meeting({ side: 'employee' }) } })
    const user = userEvent.setup()
    at('/one-on-ones/m1', <OneOnOneDetail />, '/one-on-ones/:id')

    expect(await screen.findByText('1:1 with Ravi')).toBeInTheDocument()
    expect(screen.getByText('Talked growth')).toBeInTheDocument()
    expect(screen.getByText(/Asha to do · carried from last time/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Private note')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('New talking point'), 'Promotion path')
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0])
    expect(API.post).toHaveBeenCalledWith('/one-on-ones/m1/items', { kind: 'point', text: 'Promotion path' })
  })

  it('ticks off an action', async () => {
    API.get.mockResolvedValue({ data: { oneOnOne: meeting({ side: 'manager', privateNote: '' }) } })
    API.patch.mockResolvedValue({ data: { oneOnOne: meeting({ side: 'manager' }) } })
    const user = userEvent.setup()
    at('/one-on-ones/m1', <OneOnOneDetail />, '/one-on-ones/:id')

    await user.click(await screen.findByRole('checkbox', { name: 'Write the design doc' }))

    expect(API.patch).toHaveBeenCalledWith('/one-on-ones/m1/items/i1', { done: true })
    expect(screen.getByLabelText('Private note')).toBeInTheDocument()
  })
})

describe('ordering 1:1s', () => {
  it('puts the soonest coming one first, then the ones held', () => {
    const rows = [
      { _id: 'a', status: 'done', date: '2026-09-01', time: '' },
      { _id: 'b', status: 'upcoming', date: '2026-09-29', time: '10:00' },
      { _id: 'c', status: 'upcoming', date: '2026-09-22', time: '10:00' }
    ]
    expect(orderMeetings(rows).map(r => r._id)).toEqual(['c', 'b', 'a'])
  })
})
