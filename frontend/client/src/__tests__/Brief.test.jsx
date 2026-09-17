import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import Brief from '../pages/Brief'

const facts = (over = {}) => ({
  date: '2026-09-17',
  isToday: true,
  workday: true,
  people: 5,
  standups: { submitted: 3, expected: 4, missing: ['Bela'] },
  blockers: [{ name: 'Asha', blocker: 'Waiting on staging credentials', days: 3 }],
  stuck: [{ name: 'Asha', blocker: 'Waiting on staging credentials', days: 3 }],
  lowMood: [{ name: 'Chirag', moods: ['stressed', 'okay', 'bad'] }],
  missingOften: [],
  attendance: { in: 4, late: [{ name: 'Dev', lateBy: 25, inAt: '10:40' }], notIn: [], lateOften: [{ name: 'Dev', days: 4 }], noCheckout: [] },
  leave: { today: [{ name: 'Esha', type: 'sick', until: '2026-09-18' }], upcoming: [], pending: 2 },
  goodNews: ['Farhan is no longer blocked'],
  attention: 3,
  ...over
})

const page = (over = {}) => ({
  date: '2026-09-17',
  today: '2026-09-17',
  title: 'MERN',
  team: { _id: 't1', name: 'MERN' },
  teams: [{ _id: 't1', name: 'MERN' }],
  canSeeAll: false,
  facts: facts(),
  brief: null,
  aiAvailable: true,
  ...over
})

const show = () => render(<MemoryRouter><Brief /></MemoryRouter>)

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('the daily brief', () => {
  it('shows the facts before anything is written', async () => {
    API.get.mockResolvedValue({ data: page() })

    show()

    expect(await screen.findByText('3 things need your attention')).toBeInTheDocument()
    expect(screen.getByText(/Blocked 3 standups: Waiting on staging credentials/)).toBeInTheDocument()
    expect(screen.getByText('Bela')).toBeInTheDocument()
    expect(screen.getByText('in 10:40 · 25m late')).toBeInTheDocument()
    expect(screen.getByText('2 requests waiting on a decision')).toBeInTheDocument()
    expect(screen.getByText(/Farhan is no longer blocked/)).toBeInTheDocument()
  })

  it('writes the brief on request and shows it', async () => {
    API.get.mockResolvedValue({ data: page() })
    API.post.mockResolvedValue({
      data: {
        brief: { summary: '**Headline**\nAsha has been stuck for three days.', generatedAt: '2026-09-17T05:30:00Z', generatedByName: 'Deepak' },
        facts: facts()
      }
    })

    show()
    await userEvent.click(await screen.findByRole('button', { name: /write the brief/i }))

    expect(API.post).toHaveBeenCalledWith('/brief', { date: '2026-09-17' })
    expect(await screen.findByText('Asha has been stuck for three days.')).toBeInTheDocument()
  })

  it('opens straight onto a brief that was already written', async () => {
    API.get.mockResolvedValue({
      data: page({ brief: { summary: 'A quiet day.', generatedAt: '2026-09-17T05:30:00Z', generatedByName: '' } })
    })

    show()

    expect(await screen.findByText('A quiet day.')).toBeInTheDocument()
    expect(screen.getByText(/by the morning job/)).toBeInTheDocument()
  })

  it('still shows the facts when the AI is switched off', async () => {
    API.get.mockResolvedValue({ data: page({ aiAvailable: false }) })

    show()

    expect(await screen.findByText(/AI brief is switched off/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /write the brief/i })).not.toBeInTheDocument()
  })

  it('says what went wrong when writing fails', async () => {
    API.get.mockResolvedValue({ data: page() })
    API.post.mockRejectedValue({ response: { data: { message: 'The brief could not be written: rate limited' } } })

    show()
    await userEvent.click(await screen.findByRole('button', { name: /write the brief/i }))

    await waitFor(() => expect(screen.getByText(/rate limited/)).toBeInTheDocument())
  })
})
