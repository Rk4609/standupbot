import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
}))

import API from '../api/axios'
import People from '../pages/People'
import { prettyDate } from '../lib/dates'

const person = (over = {}) => ({
  _id: 'u1',
  name: 'Asha Rao',
  email: 'asha@acme.test',
  role: 'employee',
  avatar: '',
  phone: '+91 98765 43210',
  dob: '1999-04-12T00:00:00.000Z',
  address: { line1: '12 Park Lane', city: 'Jaipur', state: 'RJ', pincode: '302001', country: 'India' },
  employment: {
    employeeId: 'EMP-014',
    position: 'Frontend engineer',
    department: 'Engineering',
    type: 'full-time',
    joinedOn: '2024-06-03T00:00:00.000Z',
    startsOn: null,
    endsOn: null,
    experienceYears: 2
  },
  team: { _id: 't1', name: 'MERN' },
  ...over
})

const intern = person({
  _id: 'u2',
  name: 'Kabir Sen',
  employment: {
    position: 'Frontend intern',
    type: 'intern',
    joinedOn: '2026-07-01T00:00:00.000Z',
    startsOn: '2026-07-01T00:00:00.000Z',
    endsOn: '2026-09-30T00:00:00.000Z',
    experienceYears: 0
  }
})

const payload = (over = {}) => ({
  people: [person(), intern],
  ending: [{ _id: 'u2', name: 'Kabir Sen', employment: { type: 'intern', endsOn: '2026-09-30T00:00:00.000Z' } }],
  teams: [{ _id: 't1', name: 'MERN' }],
  maySeePay: false,
  pageSizes: [10, 20, 40, 100],
  total: 2,
  page: 1,
  limit: 10,
  totalPages: 1,
  ...over
})

const answer = (over) => {
  API.get.mockResolvedValue({ data: payload(over) })
}

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset?.()
})

describe('the records list', () => {
  it('says what each person is and when they joined', async () => {
    answer()

    render(<People user={{ role: 'admin' }} />)

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByText(/Frontend engineer · MERN · EMP-014/)).toBeInTheDocument()
    // In the reader's locale, the way the page writes it — not one country's
    expect(screen.getByText(prettyDate('2024-06-03T00:00:00.000Z'))).toBeInTheDocument()
  })

  it('puts whoever is running out of time at the top', async () => {
    answer()

    render(<People user={{ role: 'admin' }} />)

    const banner = (await screen.findByText('Ending in the next month')).closest('div')
    expect(within(banner).getByText(/Kabir Sen/)).toBeInTheDocument()
    expect(within(banner).getByText(/Intern/)).toBeInTheDocument()
  })

  it('says plainly when pay is not part of your role', async () => {
    answer()

    render(<People user={{ role: 'manager' }} />)

    expect(await screen.findByText(/pay details are not part of your role/)).toBeInTheDocument()
  })

  it('shows pay to somebody whose role has it', async () => {
    answer({
      maySeePay: true,
      people: [person({ salary: { amount: 1200000, currency: 'INR', period: 'year' } })]
    })

    render(<People user={{ role: 'admin' }} />)

    // The grouping depends on the reader's locale, so ask for the same
    // formatting the page uses rather than hard-coding one country's commas
    const formatted = (1200000).toLocaleString()
    expect(await screen.findByText(`INR ${formatted}/yr`)).toBeInTheDocument()
  })

  it('asks the server for the search rather than filtering the page', async () => {
    answer()

    render(<People user={{ role: 'admin' }} />)
    await screen.findByText('Asha Rao')
    await userEvent.type(screen.getByLabelText('Search records'), 'kabir')

    await waitFor(() =>
      expect(API.get).toHaveBeenCalledWith(expect.stringContaining('search=kabir'))
    )
  })
})

describe('editing a record', () => {
  it('opens to the whole record, with the internship window for an intern', async () => {
    answer()

    render(<People user={{ role: 'admin' }} />)
    await userEvent.click(await screen.findByRole('button', { name: /Kabir Sen/ }))

    expect(screen.getByLabelText('Internship ends')).toBeInTheDocument()
    expect(screen.getByLabelText('Position')).toHaveValue('Frontend intern')
  })

  it('has no internship window on a permanent hire', async () => {
    answer()

    render(<People user={{ role: 'admin' }} />)
    await userEvent.click(await screen.findByRole('button', { name: /Asha Rao/ }))

    expect(screen.queryByLabelText('Internship ends')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pincode')).toHaveValue('302001')
  })

  it('sends the whole record in one save', async () => {
    answer()
    API.patch.mockResolvedValue({ data: { message: 'Updated', person: person() } })

    render(<People user={{ role: 'admin' }} />)
    await userEvent.click(await screen.findByRole('button', { name: /Asha Rao/ }))

    const phone = screen.getByLabelText('Phone')
    await userEvent.clear(phone)
    await userEvent.type(phone, '+91 90000 00000')
    await userEvent.click(screen.getByRole('button', { name: /save record/i }))

    await waitFor(() => expect(API.patch).toHaveBeenCalledWith(
      '/people/u1',
      expect.objectContaining({ phone: '+91 90000 00000' })
    ))
  })

  it('does not offer pay to a reader who is not allowed it', async () => {
    answer()

    render(<People user={{ role: 'manager' }} />)
    await userEvent.click(await screen.findByRole('button', { name: /Asha Rao/ }))

    expect(screen.queryByText('What they are paid')).not.toBeInTheDocument()
  })
})
