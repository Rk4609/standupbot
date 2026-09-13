import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const navigate = vi.fn()
// Only useNavigate is replaced — Button still needs the real Link
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate
}))

import API from '../api/axios'
import NewStandup from '../pages/NewStandup'

const CORE = ['yesterday', 'today', 'blockers']

const template = (overrides = {}) => ({
  data: {
    name: 'Morning check-in',
    askMood: true,
    coreKeys: CORE,
    questions: [
      { key: 'yesterday', label: 'What did you get done?', type: 'long', required: true },
      { key: 'today', label: 'What is the plan?', type: 'long', required: true },
      { key: 'blockers', label: 'Anything in your way?', type: 'long', required: false }
    ],
    ...overrides
  }
})

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
  navigate.mockReset()
  API.get.mockResolvedValue(template())
  API.post.mockResolvedValue({ data: {} })
})

describe('the standup form', () => {
  it('asks the questions the team wrote, in their words', async () => {
    render(<NewStandup />)

    expect(await screen.findByText('What did you get done?')).toBeInTheDocument()
    expect(screen.getByText('What is the plan?')).toBeInTheDocument()
    expect(screen.getByText('Anything in your way?')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Morning check-in' })).toBeInTheDocument()
  })

  it('marks the questions the team made optional', async () => {
    render(<NewStandup />)
    await screen.findByText('Anything in your way?')

    // Two required questions, so exactly one is flagged optional
    expect(screen.getAllByText('(optional)')).toHaveLength(1)
  })

  it('sends core answers as their own fields and the rest as answers', async () => {
    const user = userEvent.setup()
    API.get.mockResolvedValue(
      template({
        questions: [
          { key: 'yesterday', label: 'Yesterday', type: 'long', required: true },
          { key: 'today', label: 'Today', type: 'long', required: true },
          { key: 'blockers', label: 'Blockers', type: 'long', required: false },
          { key: 'learned', label: 'What did you learn?', type: 'short', required: false }
        ]
      })
    )

    render(<NewStandup />)
    await screen.findByText('What did you learn?')

    const boxes = screen.getAllByRole('textbox')
    await user.type(boxes[0], 'Shipped the export')
    await user.type(boxes[1], 'Start on templates')
    await user.type(boxes[3], 'Maps serialise as objects')

    await user.click(screen.getByRole('button', { name: /submit standup/i }))

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/standups', {
        mood: 'good',
        yesterday: 'Shipped the export',
        today: 'Start on templates',
        blockers: '',
        answers: { learned: 'Maps serialise as objects' }
      })
    )
  })

  it('will not submit while a required question is empty', async () => {
    const user = userEvent.setup()
    render(<NewStandup />)
    await screen.findByText('What did you get done?')

    const submit = screen.getByRole('button', { name: /submit standup/i })
    expect(submit).toBeDisabled()
    expect(screen.getByText(/Still to answer/)).toHaveTextContent('What is the plan?')

    const boxes = screen.getAllByRole('textbox')
    await user.type(boxes[0], 'a')
    await user.type(boxes[1], 'b')

    await waitFor(() => expect(submit).toBeEnabled())
    expect(API.post).not.toHaveBeenCalled()
  })

  it('hides the mood picker when the team turned it off', async () => {
    API.get.mockResolvedValue(template({ askMood: false }))
    render(<NewStandup />)
    await screen.findByText('What did you get done?')

    expect(screen.queryByText('How are you feeling today?')).not.toBeInTheDocument()
  })

  it('falls back to the standard questions rather than blocking on a failed fetch', async () => {
    // Being unable to file a standup is worse than losing the team's wording
    API.get.mockRejectedValue(new Error('offline'))
    render(<NewStandup />)

    expect(
      await screen.findByText('What are you working on today?')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit standup/i })).toBeInTheDocument()
  })

  it('does not ask about yesterday by default', async () => {
    // The answer is usually yesterday's plan, which the app already has
    API.get.mockRejectedValue(new Error('offline'))
    render(<NewStandup />)

    await screen.findByText('What are you working on today?')
    expect(screen.queryByText(/accomplish yesterday/i)).not.toBeInTheDocument()
  })

  it('renders a short question as a single-line box', async () => {
    API.get.mockResolvedValue(
      template({
        questions: [
          { key: 'yesterday', label: 'Yesterday', type: 'long', required: true },
          { key: 'today', label: 'Today', type: 'long', required: true },
          { key: 'blockers', label: 'Blockers', type: 'long', required: false },
          { key: 'confidence', label: 'How confident?', type: 'short', required: false }
        ]
      })
    )

    render(<NewStandup />)
    await screen.findByText('How confident?')

    const boxes = screen.getAllByRole('textbox')
    expect(boxes[3].tagName).toBe('INPUT')
    expect(boxes[0].tagName).toBe('TEXTAREA')
  })
})
