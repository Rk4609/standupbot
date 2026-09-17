import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import CommandPalette from '../components/CommandPalette'
import { rank, score } from '../lib/commandSearch'

const employee = { _id: 'u1', name: 'Asha', role: 'employee', modules: ['dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'support'] }
const manager = { ...employee, role: 'manager', modules: [...employee.modules, 'team', 'employees', 'leaves', 'brief'] }

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

const open = (user = employee, props = {}) => {
  const onClose = vi.fn()
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <CommandPalette open user={user} dark={false} onClose={onClose} onToggleTheme={vi.fn()} onLogout={vi.fn()} {...props} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>
  )
  return { onClose }
}

beforeEach(() => {
  localStorage.clear()
})

describe('matching', () => {
  it('prefers the start of a word, and still finds letters in order', () => {
    expect(score('lea', 'Leave')).toBeGreaterThan(score('lea', 'Weekly retro'))
    expect(score('lvap', 'Leave approvals')).toBeGreaterThan(0)
    expect(score('xyz', 'Leave')).toBe(0)
    // Letters that only line up across the whole name are not a match
    expect(score('sal', 'Standup template')).toBe(0)
  })

  it('finds a page by its group and name, but not every page in a group', () => {
    const items = [
      { id: '/attendance', label: 'Attendance', group: 'My HR' },
      { id: '/team-attendance', label: 'Attendance', group: 'Team' },
      { id: '/employees', label: 'Employees', group: 'Team' }
    ]
    expect(rank(items, 'team attendance').map(i => i.id)[0]).toBe('/team-attendance')
    expect(rank(items, 'sal')).toEqual([])
  })

  it('finds a page by the word people use for it', () => {
    const items = [
      { id: '/payslips', label: 'Payslips', keywords: ['salary', 'tankha'] },
      { id: '/leave', label: 'Leave', keywords: ['chhutti', 'holiday'] }
    ]
    expect(rank(items, 'chhutti')[0].id).toBe('/leave')
    expect(rank(items, 'salary')[0].id).toBe('/payslips')
  })
})

describe('the palette', () => {
  it('opens a page with the keyboard', async () => {
    open()

    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'chhutti')
    await userEvent.keyboard('{Enter}')

    expect(screen.getByTestId('where')).toHaveTextContent('/leave')
  })

  it('moves through the list with the arrow keys', async () => {
    open()

    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'a')
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('only offers the pages this person can open', async () => {
    open(employee)
    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'leave approvals')
    expect(screen.queryByRole('option', { name: /Leave approvals/ })).not.toBeInTheDocument()
  })

  it('offers a manager their team pages', async () => {
    open(manager)
    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'leave approvals')
    expect(screen.getByRole('option', { name: /Leave approvals/ })).toBeInTheDocument()
  })

  it('runs an action, like switching the theme', async () => {
    const onToggleTheme = vi.fn()
    open(employee, { onToggleTheme })

    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'dark')
    await userEvent.keyboard('{Enter}')

    expect(onToggleTheme).toHaveBeenCalled()
  })

  it('shows recently opened pages first when nothing is typed', async () => {
    localStorage.setItem('palette-recent', JSON.stringify(['/payslips']))
    open()

    const first = screen.getAllByRole('option')[0]
    expect(first).toHaveTextContent('Payslips')
    expect(first).toHaveTextContent('Recent')
  })

  it('says so when nothing matches, and closes on Escape', async () => {
    const { onClose } = open()

    await userEvent.type(screen.getByLabelText('Search pages and actions'), 'zzzz')
    expect(screen.getByText(/Nothing called/)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
