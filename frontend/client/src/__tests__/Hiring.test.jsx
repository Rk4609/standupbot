import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() }
}))

import API from '../api/axios'
import Hiring from '../pages/Hiring'

const candidate = (over = {}) => ({
  _id: 'c1',
  name: 'Meera Joshi',
  email: 'meera@acme.test',
  phone: '+91 98220 44551',
  dob: '1998-08-09T00:00:00.000Z',
  address: { line1: '19 Hill View', city: 'Indore', state: 'MP', pincode: '452010' },
  position: 'Backend engineer',
  department: 'Engineering',
  team: { _id: 't1', name: 'MERN' },
  type: 'probation',
  joiningOn: '2026-10-15T00:00:00.000Z',
  endsOn: '2027-04-15T00:00:00.000Z',
  experienceYears: 3,
  cv: { url: 'https://example.com/meera.pdf', name: 'meera.pdf' },
  notes: 'Three years at a payments company.',
  status: 'pending',
  submittedByName: 'deepak',
  ...over
})

const payload = (over = {}) => ({
  candidates: [candidate()],
  pendingCount: 1,
  teams: [{ _id: 't1', name: 'MERN' }],
  statuses: ['pending', 'approved', 'rejected'],
  types: ['intern', 'probation', 'full-time', 'contract'],
  canDecide: false,
  maySeePay: false,
  pageSizes: [10, 20, 40, 100],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  ...over
})

const manager = { role: 'manager', modules: ['dashboard', 'hiring'] }
const admin = { role: 'admin', modules: ['dashboard', 'hiring', 'approvals'] }
const decider = { role: 'admin', modules: ['dashboard', 'approvals'] }

/** Where the page thinks it is, so a test can see the switch move the address. */
function Address() {
  const { search } = useLocation()
  return <output aria-label="address">{search}</output>
}

const renderAt = (ui, entry = '/workspace/hiring') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/workspace/hiring" element={<>{ui}<Address /></>} />
      </Routes>
    </MemoryRouter>
  )

const answer = (over) => {
  API.get.mockResolvedValue({ data: payload(over) })
}

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
})

describe('a manager putting somebody forward', () => {
  it('lists what they sent and what happened to it', async () => {
    answer({
      candidates: [
        candidate(),
        candidate({
          _id: 'c2',
          name: 'Farhan Qureshi',
          status: 'rejected',
          decidedByName: 'The Admin',
          reason: 'No contract headcount until April'
        })
      ]
    })

    renderAt(<Hiring user={manager} />)

    expect(await screen.findByText('Meera Joshi')).toBeInTheDocument()

    // 'Waiting' is also one of the filter's options, so ask the list
    const rows = within(screen.getByRole('list'))
    expect(rows.getByText('Waiting')).toBeInTheDocument()
    expect(rows.getByText('Rejected')).toBeInTheDocument()
  })

  it('shows the reason a rejection came with', async () => {
    answer({
      candidates: [candidate({
        status: 'rejected',
        decidedByName: 'The Admin',
        reason: 'No contract headcount until April'
      })]
    })

    renderAt(<Hiring user={manager} />)
    await userEvent.click(await screen.findByRole('button', { name: /Meera Joshi/ }))

    expect(screen.getByText(/No contract headcount until April/)).toBeInTheDocument()
  })

  it('sends the whole record in one submission', async () => {
    answer()
    API.post.mockResolvedValue({ data: candidate({ name: 'Kabir Sen' }) })

    renderAt(<Hiring user={manager} />)
    await userEvent.click(await screen.findByRole('button', { name: /new joining/i }))

    await userEvent.type(screen.getByLabelText('Full name'), 'Kabir Sen')
    await userEvent.type(screen.getByLabelText('Email'), 'kabir@acme.test')
    await userEvent.type(screen.getByLabelText('Position'), 'Frontend intern')
    await userEvent.selectOptions(screen.getByLabelText('Kind of hire'), 'intern')
    await userEvent.click(screen.getByRole('button', { name: /send for approval/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/hiring', expect.objectContaining({
      name: 'Kabir Sen',
      email: 'kabir@acme.test',
      position: 'Frontend intern',
      type: 'intern'
    })))
  })

  it('asks for the internship window only when there is one', async () => {
    answer()

    renderAt(<Hiring user={manager} />)
    await userEvent.click(await screen.findByRole('button', { name: /new joining/i }))

    expect(screen.queryByLabelText('Internship ends')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Kind of hire'), 'intern')
    expect(screen.getByLabelText('Internship ends')).toBeInTheDocument()
  })

  it('will not send without a name, an email and a position', async () => {
    answer()

    renderAt(<Hiring user={manager} />)
    await userEvent.click(await screen.findByRole('button', { name: /new joining/i }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Kabir Sen')

    expect(screen.getByRole('button', { name: /send for approval/i })).toBeDisabled()
  })

  it('offers no approve button to the person who asked', async () => {
    answer()

    renderAt(<Hiring user={manager} />)
    await screen.findByText('Meera Joshi')

    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /withdraw Meera Joshi/i })).toBeInTheDocument()
  })

  it('keeps the pay field out of the form when pay is not their business', async () => {
    answer()

    renderAt(<Hiring user={manager} />)
    await userEvent.click(await screen.findByRole('button', { name: /new joining/i }))

    expect(screen.queryByLabelText('Agreed pay')).not.toBeInTheDocument()
  })
})

describe('an admin deciding', () => {
  it('approves, and hands back the password once', async () => {
    answer({ canDecide: true })
    API.post.mockResolvedValue({
      data: {
        message: 'Meera Joshi approved — account created',
        candidate: candidate({ status: 'approved' }),
        account: { _id: 'u9', email: 'meera@acme.test', tempPassword: 'a1b2c3d4-e5f6' }
      }
    })

    renderAt(<Hiring user={admin} />, '/workspace/hiring?view=decide')
    await userEvent.click(await screen.findByRole('button', { name: /^approve$/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/hiring/c1/approve', {}))
    expect(await screen.findByText('a1b2c3d4-e5f6')).toBeInTheDocument()
  })

  it('will not reject without saying why', async () => {
    answer({ canDecide: true })

    renderAt(<Hiring user={admin} />, '/workspace/hiring?view=decide')
    await userEvent.click(await screen.findByRole('button', { name: /^reject$/i }))

    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('button', { name: /^reject$/i })).toBeDisabled()
  })

  it('sends the reason with the rejection', async () => {
    answer({ canDecide: true })
    API.post.mockResolvedValue({ data: { message: 'Meera Joshi rejected' } })

    renderAt(<Hiring user={admin} />, '/workspace/hiring?view=decide')
    await userEvent.click(await screen.findByRole('button', { name: /^reject$/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(screen.getByLabelText('Why'), 'No headcount until April')
    await userEvent.click(dialog.getByRole('button', { name: /^reject$/i }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/hiring/c1/reject', {
      reason: 'No headcount until April'
    }))
  })
})

describe('the switch between everybody and what waits on you', () => {
  it('is not offered to somebody who cannot decide', async () => {
    answer()

    renderAt(<Hiring user={manager} />, '/workspace/hiring?view=decide')
    await screen.findByText('Meera Joshi')

    expect(screen.queryByRole('link', { name: /waiting for your decision/i })).not.toBeInTheDocument()
    expect(API.get).toHaveBeenCalledWith(expect.not.stringContaining('status='))
  })

  it('opens on everybody, and moves to the waiting ones through the address', async () => {
    answer({ canDecide: true })

    renderAt(<Hiring user={admin} />)
    await screen.findByText('Meera Joshi')

    expect(screen.getByRole('link', { name: /all candidates/i })).toHaveAttribute('aria-current', 'page')
    expect(API.get).toHaveBeenLastCalledWith(expect.not.stringContaining('status='))

    await userEvent.click(screen.getByRole('link', { name: /waiting for your decision/i }))

    expect(screen.getByRole('status', { name: 'address' })).toHaveTextContent('?view=decide')
    await waitFor(() => expect(API.get).toHaveBeenLastCalledWith(expect.stringContaining('status=pending')))
    expect(await screen.findByText('Waiting on you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new joining/i })).not.toBeInTheDocument()
  })

  it('goes back to everybody from the waiting ones', async () => {
    answer({ canDecide: true })

    renderAt(<Hiring user={admin} />, '/workspace/hiring?view=decide')
    await screen.findByText('Waiting on you')
    await userEvent.click(screen.getByRole('link', { name: /all candidates/i }))

    expect(await screen.findByText('Your submissions')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'address' })).toHaveTextContent(/^$/)
  })

  it('gives somebody who may only decide the waiting ones, with no switch', async () => {
    answer({ canDecide: true })

    renderAt(<Hiring user={decider} />)

    expect(await screen.findByText('Waiting on you')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /all candidates/i })).not.toBeInTheDocument()
    expect(API.get).toHaveBeenCalledWith(expect.stringContaining('status=pending'))
  })
})
