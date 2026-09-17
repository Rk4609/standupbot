import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

import API from '../api/axios'
import SessionsCard from '../components/SessionsCard'

const now = new Date().toISOString()
const sessions = {
  sessions: [
    { _id: 's1', device: 'Chrome on Windows', ip: '49.36.x.x', createdAt: now, lastSeenAt: now, current: true },
    { _id: 's2', device: 'Safari on iOS', ip: '', createdAt: now, lastSeenAt: now, current: false }
  ],
  untracked: false
}

beforeEach(() => { for (const fn of Object.values(API)) fn.mockReset() })

describe('where you are signed in', () => {
  it('lists devices, marks this one, and signs another out', async () => {
    API.get.mockResolvedValue({ data: sessions })
    API.delete.mockResolvedValue({ data: {} })

    render(<SessionsCard />)

    expect(await screen.findByText('This device')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Sign out' })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0])
    await waitFor(() => expect(API.delete).toHaveBeenCalledWith('/sessions/s2'))
  })

  it('signs out everywhere else in one go', async () => {
    API.get.mockResolvedValue({ data: sessions })
    API.post.mockResolvedValue({ data: { message: 'Signed out on 1 other device', count: 1 } })

    render(<SessionsCard />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere else' }))

    expect(API.post).toHaveBeenCalledWith('/sessions/others', {})
  })
})
