import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))

import API from '../api/axios'
import Activity from '../pages/Activity'

const payload = {
  entries: [
    {
      _id: 'a1',
      action: 'standup.updated',
      actorName: 'Priya Nair',
      subjectName: 'Arjun Mehta',
      note: '2026-09-11',
      createdAt: '2026-09-12T17:30:00.000Z',
      changes: [
        { field: 'today', from: 'Chase the vendor', to: 'Chase the vendor, then unblock Rohit' },
        { field: 'mood', from: 'okay', to: 'good' }
      ]
    },
    {
      _id: 'a2',
      action: 'user.role_changed',
      actorName: 'Priya Nair',
      subjectName: 'Sara Khan',
      note: '',
      createdAt: '2026-09-12T16:00:00.000Z',
      changes: [{ field: 'role', from: 'employee', to: 'manager' }]
    }
  ],
  actions: ['standup.updated', 'standup.deleted', 'user.role_changed'],
  pageSizes: [10, 20, 40, 100],
  total: 2,
  page: 1,
  limit: 10,
  totalPages: 1
}

beforeEach(() => {
  // The chosen page size is remembered per browser; start each test fresh
  window.localStorage.clear()
  API.get.mockReset()
  API.get.mockResolvedValue({ data: payload })
})

describe('Activity page', () => {
  it('names who did what to whom', async () => {
    render(<Activity />)

    const list = within(await screen.findByRole('list'))
    expect(list.getByText('Standup edited')).toBeInTheDocument()
    expect(list.getByText('Role changed')).toBeInTheDocument()
    expect(list.getByText('Arjun Mehta')).toBeInTheDocument()
    expect(list.getAllByText('Priya Nair')).toHaveLength(2)
  })

  it('shows the old value and the new one, not just that something changed', async () => {
    render(<Activity />)

    expect(await screen.findByText('Chase the vendor')).toBeInTheDocument()
    expect(screen.getByText('Chase the vendor, then unblock Rohit')).toBeInTheDocument()
    expect(screen.getByText('employee')).toBeInTheDocument()
    expect(screen.getByText('manager')).toBeInTheDocument()
  })

  it('labels fields readably rather than by their key', async () => {
    render(<Activity />)

    expect(await screen.findByText("Today's plan")).toBeInTheDocument()
    expect(screen.getByText('Mood')).toBeInTheDocument()
    expect(screen.queryByText('today')).not.toBeInTheDocument()
  })

  it('refetches when the action filter changes, and returns to page one', async () => {
    const user = userEvent.setup()
    render(<Activity />)
    await screen.findByRole('list')

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'user.role_changed')

    await waitFor(() =>
      expect(API.get).toHaveBeenLastCalledWith('/audit', {
        params: { page: 1, limit: 10, action: 'user.role_changed' }
      })
    )
  })

  it('omits the action parameter when nothing is filtered', async () => {
    render(<Activity />)
    await screen.findByRole('list')

    expect(API.get).toHaveBeenCalledWith('/audit', {
      params: { page: 1, limit: 10, action: undefined }
    })
  })

  it('offers a page size only once there is more than one page of ten', async () => {
    render(<Activity />)
    await screen.findByRole('list')

    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument()
  })

  it('refetches from page one with the rows per page chosen', async () => {
    const user = userEvent.setup()
    API.get.mockResolvedValue({ data: { ...payload, total: 34, page: 2, totalPages: 4 } })
    render(<Activity />)
    await screen.findByRole('list')

    await user.selectOptions(screen.getByLabelText('Rows per page'), '40')

    await waitFor(() =>
      expect(API.get).toHaveBeenLastCalledWith('/audit', {
        params: { page: 1, limit: 40, action: undefined }
      })
    )
  })

  it('says so plainly when there is nothing recorded', async () => {
    API.get.mockResolvedValue({ data: { ...payload, entries: [], total: 0 } })
    render(<Activity />)

    expect(await screen.findByText('Nothing recorded yet')).toBeInTheDocument()
  })

  it('reports a failed load instead of rendering an empty page', async () => {
    API.get.mockRejectedValue({ response: { data: { message: 'Not your team' } } })
    render(<Activity />)

    expect(await screen.findByText('Not your team')).toBeInTheDocument()
  })
})
