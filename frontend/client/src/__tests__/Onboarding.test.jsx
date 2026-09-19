import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

import API from '../api/axios'
import { saveUser } from '../store/authStore'
import Onboarding from '../pages/Onboarding'
import OnboardingDetail from '../pages/OnboardingDetail'

const task = (id, owner, over = {}) => ({
  _id: id,
  title: `${owner} task ${id}`,
  owner,
  dueOn: '2026-09-15',
  done: false,
  overdue: false,
  canTick: owner === 'employee',
  ...over
})

const checklist = (over = {}) => ({
  _id: 'o1',
  user: 'joiner',
  userName: 'Kabir Sen',
  position: 'Frontend intern',
  startsOn: '2026-09-14',
  status: 'active',
  canEdit: false,
  tasks: [
    task('t1', 'hr', { done: true, doneByName: 'The Admin', doneAt: '2026-09-14T10:00:00Z' }),
    task('t2', 'manager', { overdue: true }),
    task('t3', 'employee', { title: 'First standup submitted' })
  ],
  progress: { done: 1, total: 3, percent: 33, overdue: 1 },
  ...over
})

const at = (path, element, route) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="/onboarding/:id" element={<p>opened checklist</p>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset()
  saveUser({ _id: 'joiner', name: 'Kabir Sen', token: 't' })
})

describe('a joiner\'s own checklist', () => {
  it('shows progress and lets them tick only their own tasks', async () => {
    API.get.mockResolvedValue({ data: { onboarding: checklist() } })
    API.patch.mockResolvedValue({
      data: {
        onboarding: checklist({
          tasks: [...checklist().tasks.slice(0, 2), task('t3', 'employee', { title: 'First standup submitted', done: true, doneByName: 'Kabir Sen' })],
          progress: { done: 2, total: 3, percent: 67, overdue: 1 }
        })
      }
    })

    at('/onboarding/me', <OnboardingDetail />, '/onboarding/:id')

    expect(await screen.findByText('Welcome aboard')).toBeInTheDocument()
    expect(API.get).toHaveBeenCalledWith('/onboarding/mine')
    expect(screen.getByText('1 overdue')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'manager task t2' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: 'First standup submitted' }))

    expect(API.patch).toHaveBeenCalledWith('/onboarding/o1/tasks/t3', { done: true })
    expect(await screen.findByText('2/3')).toBeInTheDocument()
  })

  it('says so when there is no checklist', async () => {
    API.get.mockResolvedValue({ data: { onboarding: null } })

    at('/onboarding/me', <OnboardingDetail />, '/onboarding/:id')

    expect(await screen.findByText('No onboarding checklist')).toBeInTheDocument()
  })

  it('lets a manager add a task to the list', async () => {
    saveUser({ _id: 'lead', name: 'Deepak', token: 't' })
    API.get.mockResolvedValue({ data: { onboarding: checklist({ canEdit: true }) } })
    API.post.mockResolvedValue({ data: { onboarding: checklist({ canEdit: true }) } })

    at('/onboarding/o1', <OnboardingDetail />, '/onboarding/:id')
    await userEvent.click(await screen.findByRole('button', { name: /add a task for manager/i }))
    await userEvent.type(screen.getByLabelText('Task'), 'Client VPN access')
    await userEvent.type(screen.getByLabelText('Due'), '2026-09-18')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/onboarding/o1/tasks', {
      title: 'Client VPN access', owner: 'manager', dueOn: '2026-09-18'
    }))
  })
})

describe('everybody being onboarded', () => {
  const list = (over = {}) => ({
    status: 'active',
    today: '2026-09-17',
    onboardings: [{
      _id: 'o1', userName: 'Kabir Sen', position: 'Frontend intern', team: 'MERN', startsOn: '2026-09-14',
      status: 'active', progress: { done: 4, total: 12, percent: 33, overdue: 2 },
      next: { title: 'Buddy assigned', owner: 'manager', dueOn: '2026-09-15', overdue: true }
    }],
    counts: { active: 1, complete: 3 },
    people: [{ _id: 'u9', name: 'Riya Das', position: 'QA engineer', joinedOn: '2025-02-01' }],
    ...over
  })

  it('shows each joiner\'s progress and what is next', async () => {
    API.get.mockResolvedValue({ data: list() })

    at('/workspace/onboarding', <Onboarding />, '/workspace/onboarding')

    expect(await screen.findByText('Kabir Sen')).toBeInTheDocument()
    expect(screen.getByText('4/12')).toBeInTheDocument()
    expect(screen.getByText('2 overdue')).toBeInTheDocument()
    expect(screen.getByText(/Buddy assigned/)).toBeInTheDocument()
  })

  it('shows ten checklists at a time, with the rest on the next page', async () => {
    const onboardings = Array.from({ length: 25 }, (_, i) => ({
      ...list().onboardings[0], _id: `o${i + 1}`, userName: `Joiner ${i + 1}`, next: null
    }))
    API.get.mockResolvedValue({ data: list({ onboardings, counts: { active: 25, complete: 0 } }) })

    at('/workspace/onboarding', <Onboarding />, '/workspace/onboarding')

    expect(await screen.findByText('Joiner 1')).toBeInTheDocument()
    expect(screen.getByText('Joiner 10')).toBeInTheDocument()
    expect(screen.queryByText('Joiner 11')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('10')
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Joiner 11')).toBeInTheDocument()
    expect(screen.queryByText('Joiner 1')).not.toBeInTheDocument()

    // Forty a page fits everybody; the tab counts never change with the page
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '40')
    expect(screen.getByText('Joiner 1')).toBeInTheDocument()
    expect(screen.getByText('Joiner 25')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /In progress/ })).toHaveTextContent('25')
  })

  it('starts a checklist by hand and opens it', async () => {
    API.get.mockResolvedValue({ data: list() })
    API.post.mockResolvedValue({ data: { message: 'Started', onboarding: { _id: 'o2' } } })

    at('/workspace/onboarding', <Onboarding />, '/workspace/onboarding')
    await userEvent.click(await screen.findByRole('button', { name: /start onboarding/i }))

    const dialog = within(screen.getByRole('dialog'))
    await userEvent.selectOptions(dialog.getByLabelText('Person'), 'u9')
    await userEvent.click(dialog.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/onboarding', { user: 'u9' }))
    expect(await screen.findByText('opened checklist')).toBeInTheDocument()
  })
})
