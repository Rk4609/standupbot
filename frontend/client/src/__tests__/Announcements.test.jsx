import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

import API from '../api/axios'
import AnnouncementBanner from '../components/AnnouncementBanner'
import Announcements from '../pages/Announcements'

const item = (over = {}) => ({
  _id: 'a1', title: 'Office closed Friday', body: 'Diwali — see you Monday.', important: true,
  team: null, authorName: 'Rakesh', createdAt: '2026-09-17T10:00:00Z', read: false, canDelete: false, ...over
})

beforeEach(() => { for (const fn of Object.values(API)) fn.mockReset() })

describe('announcements', () => {
  it('shows unread ones on the dashboard until "Got it"', async () => {
    API.get.mockResolvedValue({ data: { announcements: [item(), item({ _id: 'a2', title: 'Old news', read: true })] } })
    API.post.mockResolvedValue({ data: {} })

    render(<AnnouncementBanner />)

    expect(await screen.findByText('Office closed Friday')).toBeInTheDocument()
    expect(screen.queryByText('Old news')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(API.post).toHaveBeenCalledWith('/announcements/a1/read', {})
    expect(screen.queryByText('Office closed Friday')).not.toBeInTheDocument()
  })

  it('lets an admin post to one team, and shows how many have read it', async () => {
    API.get.mockResolvedValue({
      data: {
        announcements: [item({ readCount: 5, audienceCount: 10, canDelete: true })],
        canPost: true, postTo: 'any', teams: [{ _id: 't1', name: 'MERN' }]
      }
    })
    API.post.mockResolvedValue({ data: {} })

    render(<Announcements />)

    expect(await screen.findByText('Read by 4 of 10')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('To'), 't1')
    await userEvent.type(screen.getByLabelText('Title'), 'Demo at 4')
    await userEvent.type(screen.getByLabelText('Message'), 'Join the MERN demo')
    await userEvent.click(screen.getByRole('button', { name: 'Send to MERN' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/announcements', {
      title: 'Demo at 4', body: 'Join the MERN demo', important: false, team: 't1'
    }))
  })
})
