import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() }
}))

// Recharts measures its container, and jsdom reports every element as 0x0, so
// the charts would render nothing. Give the container a fixed size instead.
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children, height = 200 }) => (
      <div style={{ width: 640, height }}>
        {typeof children === 'function' ? children({ width: 640, height }) : children}
      </div>
    )
  }
})

import API from '../api/axios'
import Analytics from '../pages/Analytics'

const day = (iso, over = {}) => ({
  date: iso,
  weekend: false,
  submissions: 4,
  expected: 5,
  blockers: 1,
  avgMood: 3.8,
  ...over
})

const overview = {
  range: { from: '2026-08-14', to: '2026-09-12', days: 30, workingDays: 22 },
  headline: {
    submissions: 88,
    expected: 110,
    participationRate: 80,
    activePeople: 5,
    rosterSize: 5,
    blockersRaised: 12,
    avgMood: 3.8
  },
  daily: [
    day('2026-09-09'),
    day('2026-09-10'),
    day('2026-09-11'),
    day('2026-09-12', { submissions: 5, blockers: 0, avgMood: 4.2 }),
    day('2026-09-13', { weekend: true, submissions: 0, expected: 0, blockers: 0, avgMood: null })
  ],
  moodTotals: { great: 20, good: 40, okay: 18, bad: 6, stressed: 4 },
  people: [
    {
      _id: 'u1',
      name: 'Asha Rao',
      team: 'Alpha',
      submissions: 20,
      rate: 91,
      avgMood: 4.3,
      blockers: 3,
      risks: []
    },
    {
      _id: 'u2',
      name: 'Kabir Shah',
      team: null,
      submissions: 6,
      rate: 27,
      avgMood: null,
      blockers: 0,
      risks: ['submitted on 6 of 22 working days']
    }
  ],
  atRisk: [
    {
      _id: 'u2',
      name: 'Kabir Shah',
      rate: 27,
      avgMood: 2.1,
      risks: ['submitted on 6 of 22 working days', 'mood has been low']
    }
  ]
}

const renderPage = () => render(<Analytics />)

beforeEach(() => {
  API.get.mockReset()
  API.get.mockResolvedValue({ data: overview })
})

describe('Analytics page', () => {
  it('asks for 30 days by default and shows the headline figures', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Participation' })
    expect(API.get).toHaveBeenCalledWith('/analytics/overview', { params: { days: 30 } })

    // The stat numbers count up from zero, so they land a few frames later
    expect(await screen.findByText('80')).toBeInTheDocument()
    expect(await screen.findByText('88')).toBeInTheDocument()
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(screen.getByText(/Avg mood · Good/)).toBeInTheDocument()
    // Averages are not rounded away — 3.8 must not read as 4
    expect(screen.getByText('3.8')).toBeInTheDocument()
  })

  it('names the window and the working days it counted', async () => {
    renderPage()

    expect(
      await screen.findByText('2026-08-14 to 2026-09-12 · 22 working days')
    ).toBeInTheDocument()
  })

  it('refetches when the range changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Participation' })

    await user.selectOptions(screen.getByLabelText('Date range'), '7')

    await waitFor(() =>
      expect(API.get).toHaveBeenCalledWith('/analytics/overview', { params: { days: 7 } })
    )
  })

  it('lists each person with their rate, and marks an unassigned team', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'By person' })

    expect(screen.getByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    // Kabir has no team and no mood, both of which render as a dash
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('explains why someone is flagged rather than just flagging them', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Needs attention' })

    expect(
      screen.getByText('submitted on 6 of 22 working days · mood has been low')
    ).toBeInTheDocument()
  })

  it('says so plainly when nobody is flagged', async () => {
    API.get.mockResolvedValue({ data: { ...overview, atRisk: [] } })
    renderPage()

    expect(await screen.findByText('Nobody is flagged for this range.')).toBeInTheDocument()
  })

  it('shows the mood split as percentages', async () => {
    renderPage()
    const card = (await screen.findByRole('heading', { name: 'Mood distribution' })).closest('div')

    // 40 of 88 submissions were "good"
    expect(within(card.parentElement).getByText('45%')).toBeInTheDocument()
  })

  it('reports a failed load instead of rendering an empty page', async () => {
    API.get.mockRejectedValue({ response: { data: { message: 'Not your team' } } })
    renderPage()

    expect(await screen.findByText('Not your team')).toBeInTheDocument()
  })

  it('downloads the export as a blob, because the CSV needs the auth header', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:csv')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    renderPage()
    await screen.findByRole('heading', { name: 'Participation' })

    API.get.mockResolvedValueOnce({ data: new Blob(['a,b'], { type: 'text/csv' }) })
    await user.click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() =>
      expect(API.get).toHaveBeenCalledWith('/analytics/export', {
        params: { days: 30 },
        responseType: 'blob'
      })
    )
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv')

    vi.unstubAllGlobals()
  })
})
