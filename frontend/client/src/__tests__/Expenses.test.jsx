import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import Expenses from '../pages/Expenses'
import ExpenseApprovals from '../pages/ExpenseApprovals'

const claim = (over = {}) => ({
  _id: 'e1',
  userName: 'Asha',
  team: { name: 'MERN' },
  category: 'travel',
  amount: 1250,
  spentOn: '2026-09-10',
  description: 'Cab to the client office',
  status: 'pending',
  receipt: { url: 'https://res.cloudinary.com/demo/r.pdf', name: 'r.pdf' },
  ...over
})

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset()
})

describe('my expenses', () => {
  const mine = (expenses = [claim()]) => API.get.mockResolvedValue({
    data: {
      expenses,
      totals: { waiting: 1250, approved: 0, paid: 0 },
      categories: ['travel', 'food', 'stay', 'equipment', 'internet', 'other'],
      today: '2026-09-17'
    }
  })

  it('shows each claim with where it is, and why one was rejected', async () => {
    mine([claim(), claim({ _id: 'e2', status: 'rejected', decidedByName: 'Ravi', note: 'Not a work trip' })])

    render(<Expenses />)

    expect(await screen.findAllByText('Cab to the client office')).toHaveLength(2)
    expect(screen.getAllByText('Waiting').length).toBeGreaterThan(0)
    expect(screen.getByText('Ravi: Not a work trip')).toBeInTheDocument()
  })

  it('sends a claim with the amount as a number', async () => {
    mine([])
    API.post.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<Expenses />)

    await user.click((await screen.findAllByRole('button', { name: /Claim an expense/ }))[0])
    await user.type(screen.getByLabelText('Amount (₹)'), '450')
    await user.type(screen.getByLabelText('Details'), 'Lunch with the client')
    await user.click(screen.getByRole('button', { name: 'Send claim' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/expenses', {
      category: 'travel', amount: 450, spentOn: '2026-09-17', description: 'Lunch with the client'
    }))
  })
})

describe('expense approvals', () => {
  const team = (expenses) => API.get.mockResolvedValue({
    data: {
      expenses,
      pending: { count: 1, amount: 1250 },
      statuses: ['pending', 'approved', 'rejected', 'paid', 'cancelled'],
      page: 1, totalPages: 1, total: expenses.length
    }
  })

  it('approves a claim', async () => {
    team([claim({ canDecide: true })])
    API.post.mockResolvedValue({ data: { message: "Asha's claim approved" } })
    const user = userEvent.setup()
    render(<ExpenseApprovals />)

    await user.click(await screen.findByRole('button', { name: /Approve/ }))

    expect(API.post).toHaveBeenCalledWith('/expenses/e1/approve', {})
  })

  it('asks why before rejecting', async () => {
    team([claim({ canDecide: true, receipt: {} })])
    API.post.mockResolvedValue({ data: { message: 'done' } })
    const user = userEvent.setup()
    render(<ExpenseApprovals />)

    expect(await screen.findByText('No receipt attached')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Reject/ }))
    const send = screen.getAllByRole('button', { name: 'Reject' }).at(-1)
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText('Why'), 'Personal trip')
    await user.click(send)

    expect(API.post).toHaveBeenCalledWith('/expenses/e1/reject', { note: 'Personal trip' })
  })
})
