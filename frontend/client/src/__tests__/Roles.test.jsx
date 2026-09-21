import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
}))

import API from '../api/axios'
import Roles from '../pages/Roles'
import { can, modulesOf } from '../lib/permissions'

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Personal', minBase: 'employee', always: true },
  { key: 'standup', label: 'Submit a standup', group: 'Personal', minBase: 'employee' },
  { key: 'support', label: 'Help & support', group: 'Personal', minBase: 'employee', always: true },
  { key: 'analytics', label: 'Analytics & exports', group: 'Team', minBase: 'manager' },
  { key: 'reports', label: 'Weekly report', group: 'Team', minBase: 'manager' },
  { key: 'roles', label: 'Roles & access', group: 'Workspace', minBase: 'admin' }
]

const EMPLOYEE_ALLOWED = ['dashboard', 'standup', 'support']
const MANAGER_ALLOWED = [...EMPLOYEE_ALLOWED, 'analytics', 'reports']

const role = (over = {}) => ({
  _id: 'r1',
  key: 'delivery-lead',
  name: 'Delivery lead',
  description: 'Runs a squad',
  base: 'manager',
  modules: ['dashboard', 'standup', 'support', 'analytics'],
  allowed: MANAGER_ALLOWED,
  builtIn: false,
  people: 4,
  ...over
})

const adminRole = role({
  _id: 'r0',
  key: 'admin',
  name: 'Admin',
  base: 'admin',
  builtIn: true,
  modules: MODULES.map(m => m.key),
  allowed: MODULES.map(m => m.key),
  people: 1
})

const payload = (roles) => ({ roles, modules: MODULES, defaults: {} })

const answer = (roles = [adminRole, role()], users = []) => {
  API.get.mockImplementation(url =>
    url === '/users'
      ? Promise.resolve({ data: users })
      : Promise.resolve({ data: payload(roles) })
  )
}

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
})

// The row's own disclosure button — the name also matches the remove button
// and the assign button, which are not what any of these tests mean
const openDeliveryLead = async () => {
  const row = await screen.findByRole('button', { name: /Delivery lead/, expanded: false })
  await userEvent.click(row)
}

describe('the list of roles', () => {
  it('says what each one is and how many people hold it', async () => {
    answer()

    render(<Roles />)

    expect(await screen.findByText('Delivery lead')).toBeInTheDocument()
    expect(screen.getByText(/4 people/)).toBeInTheDocument()
    expect(screen.getByText('Built in')).toBeInTheDocument()
  })

  it('opens one to the modules it holds', async () => {
    answer()

    render(<Roles />)
    await openDeliveryLead()

    expect(screen.getByRole('checkbox', { name: /Analytics & exports/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Weekly report/ })).not.toBeChecked()
  })

  it('will not let anybody untick the ways back in', async () => {
    answer()

    render(<Roles />)
    await openDeliveryLead()

    expect(screen.getByRole('checkbox', { name: /Dashboard/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Help & support/ })).toBeDisabled()
  })

  it('does not offer a module the role could never reach anyway', async () => {
    answer()

    render(<Roles />)
    await openDeliveryLead()

    // 'roles' is admin-level, and this role is manager-level
    expect(screen.queryByRole('checkbox', { name: /Roles & access/ })).not.toBeInTheDocument()
  })

  it('says why the admin role cannot be narrowed', async () => {
    answer()

    render(<Roles />)
    await userEvent.click(await screen.findByRole('button', { name: /^Admin/ }))

    expect(screen.getByText(/way back in/i)).toBeInTheDocument()
  })
})

describe('changing what a role reaches', () => {
  it('saves the moment a box is ticked', async () => {
    answer()
    API.patch.mockResolvedValue({
      data: { ...role(), modules: ['dashboard', 'standup', 'support', 'analytics', 'reports'] }
    })

    render(<Roles />)
    await openDeliveryLead()
    await userEvent.click(screen.getByRole('checkbox', { name: /Weekly report/ }))

    await waitFor(() =>
      expect(API.patch).toHaveBeenCalledWith('/roles/r1', {
        modules: ['dashboard', 'standup', 'support', 'analytics', 'reports']
      })
    )
  })

  it('puts the box back when the server refuses', async () => {
    answer()
    API.patch.mockRejectedValue({ response: { data: { message: 'no' } } })

    render(<Roles />)
    await openDeliveryLead()
    await userEvent.click(screen.getByRole('checkbox', { name: /Weekly report/ }))

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /Weekly report/ })).not.toBeChecked()
    )
  })
})

describe('naming a new role', () => {
  it('sends the name and the level', async () => {
    answer()
    API.post.mockResolvedValue({ data: role({ _id: 'r9', name: 'Contractor' }) })

    render(<Roles />)
    await userEvent.click(await screen.findByRole('button', { name: /new role/i }))
    await userEvent.type(screen.getByLabelText('Name'), 'Contractor')
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'manager')
    await userEvent.click(screen.getByRole('button', { name: /create role/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/roles', {
      name: 'Contractor',
      description: '',
      base: 'manager'
    }))
  })
})

describe('giving a role to people', () => {
  const people = [
    { _id: 'u1', name: 'Asha Rao', email: 'asha@acme.test', role: 'employee' },
    { _id: 'u2', name: 'Rohit Shah', email: 'rohit@acme.test', role: 'employee' }
  ]

  it('moves everybody picked in one go', async () => {
    answer([role()], people)
    API.post.mockResolvedValue({ data: { message: '2 people moved to Delivery lead', count: 2 } })

    render(<Roles />)
    await openDeliveryLead()

    await userEvent.click(await screen.findByRole('checkbox', { name: /Asha Rao/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Rohit Shah/ }))
    await userEvent.click(screen.getByRole('button', { name: /Give Delivery lead to 2 people/i }))

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/roles/r1/assign', { users: ['u1', 'u2'] })
    )
  })

  it('narrows the list as you type', async () => {
    answer([role()], people)

    render(<Roles />)
    await openDeliveryLead()
    await userEvent.type(await screen.findByLabelText(/Find somebody/), 'rohit')

    const list = within(screen.getAllByRole('list').at(-1))
    expect(list.queryByText('Asha Rao')).not.toBeInTheDocument()
    expect(list.getByText('Rohit Shah')).toBeInTheDocument()
  })
})

describe('what the app thinks somebody may open', () => {
  it('reads the modules the session came with', () => {
    const user = { role: 'manager', modules: ['dashboard', 'support', 'team'] }

    expect(can(user, 'team')).toBe(true)
    expect(can(user, 'analytics')).toBe(false)
  })

  it('leaves an older session exactly as it was', () => {
    // Saved before roles existed: no modules at all
    const user = { role: 'manager' }

    expect(modulesOf(user)).toContain('analytics')
    expect(can(user, 'roles')).toBe(false)
  })

  it('never locks anybody out of the way back in', () => {
    const user = { role: 'employee', modules: [] }

    expect(can(user, 'dashboard')).toBe(true)
    expect(can(user, 'support')).toBe(true)
    expect(can(user, 'analytics')).toBe(false)
  })
})
