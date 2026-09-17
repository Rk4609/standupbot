import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

import API from '../api/axios'
import Kudos from '../pages/Kudos'
import { ago } from '../lib/kudos'

const kudos = (over = {}) => ({
  _id: 'k1',
  from: { _id: 'u1', name: 'Asha' },
  to: { _id: 'u2', name: 'Bela' },
  value: 'helpful',
  message: 'Thanks for fixing the release build',
  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  cheers: 2,
  cheered: false,
  mine: false,
  canDelete: false,
  ...over
})

const feed = (over = {}) => ({
  kudos: [kudos()],
  top: [{ _id: 'u2', name: 'Bela', count: 4 }],
  values: ['teamwork', 'ownership', 'helpful', 'quality', 'extra-mile'],
  page: 1,
  totalPages: 1,
  total: 1,
  ...over
})

const serve = (data = feed()) => {
  API.get.mockImplementation(url => {
    if (url === '/kudos/people') return Promise.resolve({ data: { people: [{ _id: 'u2', name: 'Bela', position: 'QA engineer' }] } })
    return Promise.resolve({ data })
  })
}

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset()
})

describe('kudos', () => {
  it('shows who thanked whom, what for, and who is most thanked', async () => {
    serve()

    render(<Kudos />)

    expect(await screen.findByText('“Thanks for fixing the release build”')).toBeInTheDocument()
    expect(screen.getByText(/Helpful · 3h ago/)).toBeInTheDocument()
    expect(screen.getByText('4 🙌')).toBeInTheDocument()
  })

  it('cheers, and shows the new count', async () => {
    serve()
    API.post.mockResolvedValue({ data: { kudos: kudos({ cheers: 3, cheered: true }) } })

    render(<Kudos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cheer' }))

    expect(API.post).toHaveBeenCalledWith('/kudos/k1/cheer', {})
    expect(await screen.findByRole('button', { name: 'Take back your cheer' })).toHaveTextContent('3')
  })

  it('gives kudos to a teammate, for a chosen value, with a message', async () => {
    serve()
    API.post.mockResolvedValue({ data: { kudos: kudos({ _id: 'k2', value: 'extra-mile' }) } })

    render(<Kudos />)
    await userEvent.click((await screen.findAllByRole('button', { name: /give kudos/i }))[0])

    const dialog = within(screen.getByRole('dialog'))
    await waitFor(() => expect(dialog.getByRole('option', { name: /Bela · QA engineer/ })).toBeInTheDocument())
    await userEvent.selectOptions(dialog.getByLabelText('Who'), 'u2')
    await userEvent.click(dialog.getByRole('button', { name: /Extra mile/ }))
    await userEvent.type(dialog.getByLabelText('Message'), 'Stayed late to ship it')
    await userEvent.click(dialog.getByRole('button', { name: 'Send kudos' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/kudos', {
      to: 'u2', value: 'extra-mile', message: 'Stayed late to ship it'
    }))
  })

  it('offers removal only on kudos the reader may remove', async () => {
    serve(feed({ kudos: [kudos(), kudos({ _id: 'k2', canDelete: true, message: 'Mine' })] }))

    render(<Kudos />)

    await screen.findByText('“Mine”')
    expect(screen.getAllByRole('button', { name: 'Remove these kudos' })).toHaveLength(1)
  })

  it('writes time the short way', () => {
    const now = Date.parse('2026-09-17T12:00:00Z')
    expect(ago('2026-09-17T11:59:40Z', now)).toBe('just now')
    expect(ago('2026-09-17T11:15:00Z', now)).toBe('45m ago')
    expect(ago('2026-09-15T12:00:00Z', now)).toBe('2d ago')
  })
})
