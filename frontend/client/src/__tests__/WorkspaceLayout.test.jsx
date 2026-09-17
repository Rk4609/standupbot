import { describe, expect, it } from 'vitest'
import { useEffect, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkspaceLayout from '../components/WorkspaceLayout'

const admin = {
  role: 'admin',
  modules: [
    'dashboard', 'support', 'projects', 'templates', 'integrations', 'activity',
    'records', 'hiring', 'approvals', 'pay', 'people', 'roles'
  ]
}

/**
 * Stands in for a real Workspace page: counts how often it loaded, the way a
 * page's useEffect fetch would, and keeps a value somebody typed.
 */
const loads = { projects: 0, hiring: 0 }

function FakePage({ name }) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    loads[name] += 1
  }, [name])

  return (
    <main>
      <h1>{name} page</h1>
      <input aria-label={`${name} box`} value={typed} onChange={e => setTyped(e.target.value)} />
    </main>
  )
}

const renderWorkspace = () =>
  render(
    <MemoryRouter initialEntries={['/workspace/projects']}>
      <Routes>
        <Route path="/workspace" element={<WorkspaceLayout user={admin} />}>
          <Route path="projects" element={<FakePage name="projects" />} />
          <Route path="hiring" element={<FakePage name="hiring" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )

describe('switching Workspace tabs', () => {
  it('keeps the tab bar in place instead of rebuilding it', async () => {
    renderWorkspace()
    const tabs = screen.getByRole('link', { name: /Hiring/ }).closest('nav')

    await userEvent.click(screen.getByRole('link', { name: /Hiring/ }))

    expect(await screen.findByRole('heading', { name: 'hiring page' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Hiring/ }).closest('nav')).toBe(tabs)
  })

  it('shows a tab you come back to as you left it, without loading it from scratch', async () => {
    loads.projects = 0
    renderWorkspace()

    await userEvent.type(screen.getByLabelText('projects box'), 'half typed')
    await userEvent.click(screen.getByRole('link', { name: /Hiring/ }))
    await userEvent.click(screen.getByRole('link', { name: /Projects/ }))

    // Still what was typed: the page was hidden, not thrown away
    expect(await screen.findByLabelText('projects box')).toHaveValue('half typed')
  })

  it('refreshes a tab when it is shown again, so its data is not left stale', async () => {
    loads.projects = 0
    renderWorkspace()
    await act(async () => {})
    const firstLoads = loads.projects

    await userEvent.click(screen.getByRole('link', { name: /Hiring/ }))
    await userEvent.click(screen.getByRole('link', { name: /Projects/ }))

    expect(loads.projects).toBeGreaterThan(firstLoads)
  })

  it('shows only the tab that is open', async () => {
    renderWorkspace()

    await userEvent.click(screen.getByRole('link', { name: /Hiring/ }))

    expect(screen.getByRole('heading', { name: 'hiring page' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'projects page' })).toBeNull()
  })
})
