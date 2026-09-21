import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The three pages have tests of their own; here they only need to say who they are
vi.mock('../pages/Employees', () => ({ default: () => <h1>Roster page</h1> }))
vi.mock('../pages/People', () => ({
  default: ({ user }) => <h1>Records page for {user.role}</h1>
}))
vi.mock('../pages/AdminPanel', () => ({
  default: ({ user }) => <h1>Admin page for {user.role}</h1>
}))

import PeopleHub from '../pages/PeopleHub'

const admin = { role: 'admin', modules: ['dashboard', 'employees', 'records', 'people'] }
const manager = { role: 'manager', modules: ['dashboard', 'employees'] }
const hr = { role: 'manager', modules: ['dashboard', 'records'] }
// Given the module by a custom role, but the admin panel is for admins only
const managerWithPeople = { role: 'manager', modules: ['dashboard', 'employees', 'records', 'people'] }

function Address() {
  const { search } = useLocation()
  return <output aria-label="address">{search}</output>
}

const renderHub = (user, entry = '/people') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/people" element={<><PeopleHub user={user} /><Address /></>} />
      </Routes>
    </MemoryRouter>
  )

const tabNames = () =>
  screen.getAllByRole('link').map(link => link.textContent)

describe('the People page', () => {
  it('shows an admin all three tabs, opening on the roster', () => {
    renderHub(admin)

    expect(screen.getByText('People')).toBeInTheDocument()
    expect(tabNames()).toEqual(['Activity', 'HR details', 'Access'])
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Roster page' })).toBeInTheDocument()
  })

  it('shows only the tabs a role opens', () => {
    renderHub(manager)
    expect(tabNames()).toEqual(['Activity'])
  })

  it('keeps the admin panel from a non-admin who holds the module', () => {
    renderHub(managerWithPeople, '/people?tab=access')

    expect(tabNames()).toEqual(['Activity', 'HR details'])
    expect(screen.queryByRole('heading', { name: /admin page/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Roster page' })).toBeInTheDocument()
  })

  it('opens the tab the address names, and passes the user through', () => {
    renderHub(admin, '/people?tab=access')

    expect(screen.getByRole('link', { name: 'Access' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Admin page for admin' })).toBeInTheDocument()
  })

  it('falls back to the first tab it may open for an unknown or closed one', () => {
    renderHub(hr, '/people?tab=activity')

    expect(tabNames()).toEqual(['HR details'])
    expect(screen.getByRole('heading', { name: 'Records page for manager' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Roster page' })).not.toBeInTheDocument()
  })

  it('ignores a tab name it does not know', () => {
    renderHub(admin, '/people?tab=nonsense')
    expect(screen.getByRole('heading', { name: 'Roster page' })).toBeInTheDocument()
  })

  it('switches tabs through the address and keeps the last one alive underneath', async () => {
    renderHub(admin)

    await userEvent.click(screen.getByRole('link', { name: 'HR details' }))

    expect(screen.getByRole('status', { name: 'address' })).toHaveTextContent('?tab=records')
    expect(screen.getByRole('link', { name: 'HR details' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Records page for admin' })).toBeInTheDocument()

    // Hidden, not thrown away: coming back shows what was already loaded
    expect(screen.getByText('Roster page')).not.toBeVisible()
  })
})
