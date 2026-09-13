import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { patch: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import ProjectMembers from '../components/ProjectMembers'

const asha = { _id: 'u1', name: 'Asha Rao', email: 'asha@acme.test' }
const rohit = { _id: 'u2', name: 'Rohit Shah', email: 'rohit@acme.test' }

const project = (over = {}) => ({
  _id: 'p1', name: 'Acme rebuild', active: true, members: [], ...over
})

const elsewhere = project({ _id: 'p2', name: 'Internal tools' })

const renderPanel = (over = {}) =>
  render(
    <ProjectMembers
      project={project(over.project)}
      assignable={over.assignable ?? [asha, rohit]}
      projects={over.projects ?? [project(over.project), elsewhere]}
      onChanged={over.onChanged}
    />
  )

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
})

describe('a project with nobody named on it', () => {
  it('says it is open to the team rather than showing an empty list', () => {
    renderPanel()

    expect(screen.getByText(/whole team can book to it/i)).toBeInTheDocument()
  })

  it('puts somebody on it', async () => {
    const onChanged = vi.fn()
    API.patch.mockResolvedValue({ data: { members: [asha] } })

    renderPanel({ onChanged })

    await userEvent.selectOptions(screen.getByLabelText(/Add somebody to/i), 'u1')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() =>
      expect(API.patch).toHaveBeenCalledWith('/projects/p1/members', { add: ['u1'] })
    )
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
  })
})

describe('a project with people on it', () => {
  it('says plainly that nobody else can book to it', () => {
    renderPanel({ project: { members: [asha] } })

    expect(screen.getByText(/Nobody else can/i)).toBeInTheDocument()
    expect(screen.queryByText(/whole team can book/i)).not.toBeInTheDocument()
  })

  it('does not offer to add somebody who is already on it', () => {
    renderPanel({ project: { members: [asha] } })

    const picker = screen.getByLabelText(/Add somebody to/i)
    expect(within(picker).queryByText('Asha Rao')).toBeNull()
  })

  it('takes somebody off', async () => {
    API.patch.mockResolvedValue({ data: { members: [] } })

    renderPanel({ project: { members: [asha] } })
    await userEvent.click(screen.getByRole('button', { name: /Take Asha Rao off/i }))

    await waitFor(() =>
      expect(API.patch).toHaveBeenCalledWith('/projects/p1/members', { remove: ['u1'] })
    )
    expect(await screen.findByText(/whole team can book to it/i)).toBeInTheDocument()
  })

  it('moves somebody to another project, and says the hours stay put', async () => {
    API.post.mockResolvedValue({ data: { message: 'Asha Rao moved to Internal tools' } })

    renderPanel({ project: { members: [asha] } })
    await userEvent.click(screen.getByRole('button', { name: /move/i }))

    expect(screen.getByText(/hours already\s+booked here stay here/i)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText(/Move Asha Rao to/i), 'p2')

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/projects/p1/transfer', {
        user: 'u1',
        toProject: 'p2'
      })
    )
    // Her name reappears in the picker once she is off it, so ask about the
    // row rather than about the name
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Take Asha Rao off/i })).toBeNull()
    )
  })

  it('cannot move anyone when there is nowhere to move them to', () => {
    renderPanel({ project: { members: [asha] }, projects: [project({ members: [asha] })] })

    expect(screen.getByRole('button', { name: /move/i })).toBeDisabled()
  })
})
