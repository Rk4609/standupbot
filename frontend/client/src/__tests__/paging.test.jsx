import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import Expenses from '../pages/Expenses'
import { usePaged } from '../lib/paging'

const numbers = (n) => Array.from({ length: n }, (_, i) => i + 1)

beforeEach(() => {
  window.localStorage.clear()
  for (const fn of Object.values(API)) fn.mockReset()
})

describe('usePaged', () => {
  it('shows 10 at a time by default', () => {
    const { result } = renderHook(() => usePaged(numbers(25), 'test'))

    expect(result.current.size).toBe(10)
    expect(result.current.rows).toEqual(numbers(10))
    expect(result.current.totalPages).toBe(3)
    expect(result.current.total).toBe(25)
  })

  it('moves to the next page', () => {
    const { result } = renderHook(() => usePaged(numbers(25), 'test'))

    act(() => result.current.setPage(2))

    expect(result.current.page).toBe(2)
    expect(result.current.rows).toEqual(numbers(20).slice(10))
  })

  it('goes back to page 1 when the size changes, and remembers the size', () => {
    const { result } = renderHook(() => usePaged(numbers(50), 'test'))

    act(() => result.current.setPage(3))
    act(() => result.current.setSize(20))

    expect(result.current.page).toBe(1)
    expect(result.current.rows).toEqual(numbers(20))
    expect(window.localStorage.getItem('pageSize:test')).toBe('20')
  })

  it('never sits past the end when the list gets shorter', () => {
    const { result, rerender } = renderHook(({ items }) => usePaged(items, 'test'), {
      initialProps: { items: numbers(25) }
    })

    act(() => result.current.setPage(3))
    rerender({ items: numbers(12) })

    expect(result.current.page).toBe(2)
    expect(result.current.rows).toEqual([11, 12])
  })
})

describe('a paged list', () => {
  const claims = numbers(25).map(n => ({
    _id: `e${n}`,
    category: 'travel',
    amount: 100 + n,
    spentOn: '2026-09-10',
    description: `Claim number ${n}`,
    status: 'pending'
  }))

  it('shows the first 10 claims, the size picker, and pages through the rest', async () => {
    API.get.mockResolvedValue({
      data: {
        expenses: claims,
        totals: { waiting: 0, approved: 0, paid: 0 },
        categories: ['travel'],
        today: '2026-09-17'
      }
    })
    const user = userEvent.setup()
    render(<Expenses />)

    expect(await screen.findByText('Claim number 1')).toBeInTheDocument()
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.queryByText('Claim number 11')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('10')
    expect(screen.getByText('Showing 1–10 of 25')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.getByText('Claim number 11')).toBeInTheDocument()
    expect(screen.queryByText('Claim number 1')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 11–20 of 25')).toBeInTheDocument()
  })
})
