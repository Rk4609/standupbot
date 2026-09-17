import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import CelebrationsCard from '../components/CelebrationsCard'

const celebration = (over = {}) => ({
  user: { _id: 'u1', name: 'Asha Rao', avatar: '', position: 'QA engineer' },
  kind: 'birthday',
  date: '2026-09-17',
  inDays: 0,
  isMe: false,
  wished: false,
  ...over
})

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('celebrations on the dashboard', () => {
  it('shows nothing in a week without any', async () => {
    API.get.mockResolvedValue({ data: { today: '2026-09-17', celebrations: [] } })

    const { container } = render(<CelebrationsCard />)

    await waitFor(() => expect(API.get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lists today and the days ahead, and offers a wish only for today', async () => {
    API.get.mockResolvedValue({
      data: {
        celebrations: [
          celebration(),
          celebration({ user: { _id: 'u2', name: 'Bela Shah' }, kind: 'anniversary', years: 2, date: '2026-09-19', inDays: 2 })
        ]
      }
    })

    render(<CelebrationsCard />)

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByText('Birthday · Today')).toBeInTheDocument()
    expect(screen.getByText(/2 years work anniversary/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Wish' })).toHaveLength(1)
  })

  it('sends a wish with an editable message', async () => {
    API.get.mockResolvedValue({ data: { celebrations: [celebration()] } })
    API.post.mockResolvedValue({ data: { message: 'Wish sent to Asha Rao' } })

    render(<CelebrationsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Wish' }))

    const dialog = within(screen.getByRole('dialog'))
    const box = dialog.getByLabelText('Message')
    expect(box).toHaveValue('Happy birthday, Asha! Have a lovely day.')
    await userEvent.clear(box)
    await userEvent.type(box, 'Party at 5!')
    await userEvent.click(dialog.getByRole('button', { name: 'Send wish' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/celebrations/wish', {
      to: 'u1', kind: 'birthday', message: 'Party at 5!'
    }))
  })

  it('says a wish was already sent, and says "You" on your own day', async () => {
    API.get.mockResolvedValue({
      data: {
        celebrations: [
          celebration({ wished: true }),
          celebration({ user: { _id: 'me', name: 'Ira Menon' }, isMe: true })
        ]
      }
    })

    render(<CelebrationsCard />)

    expect(await screen.findByText('Wished ✓')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Your birthday · Today')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Wish' })).not.toBeInTheDocument()
  })
})
