import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

import API from '../api/axios'
import Payslips from '../pages/Payslips'
import Payroll from '../pages/Payroll'
import { inWords, money } from '../lib/money'

const slip = (over = {}) => ({
  _id: 's1',
  month: '2026-08',
  status: 'published',
  currency: 'INR',
  employee: { name: 'Asha Rao', employeeId: 'E-104', position: 'Backend engineer', department: 'Engineering' },
  workingDays: 21,
  paidDays: 19,
  lossOfPayDays: 2,
  earnings: [
    { label: 'Basic', amount: 37500 },
    { label: 'House rent allowance', amount: 15000 },
    { label: 'Special allowance', amount: 22500 }
  ],
  deductions: [
    { label: 'Provident fund', amount: 1800, note: '12% of basic' },
    { label: 'Professional tax', amount: 200 },
    { label: 'Loss of pay', amount: 7143, note: '2 days · 2 unpaid leave' }
  ],
  gross: 75000,
  totalDeductions: 9143,
  net: 65857,
  publishedAt: '2026-09-01T10:00:00.000Z',
  ...over
})

const at = (path, element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/payslips" element={element} />
        <Route path="/payslips/:id" element={element} />
        <Route path="/workspace/payroll" element={element} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
})

describe('amounts', () => {
  it('reads a net figure in words, the Indian way', () => {
    expect(inWords(65857)).toBe('Sixty Five Thousand Eight Hundred Fifty Seven')
    expect(inWords(1250000)).toBe('Twelve Lakh Fifty Thousand')
    expect(inWords(0)).toBe('Zero')
  })

  it('groups rupees in lakhs', () => {
    expect(money(1250000)).toBe('₹12,50,000')
  })
})

describe('my payslips', () => {
  it('lists each published month with its net pay', async () => {
    API.get.mockResolvedValue({ data: { payslips: [slip(), slip({ _id: 's0', month: '2026-07', net: 73000, lossOfPayDays: 0 })] } })

    at('/payslips', <Payslips />)

    expect(await screen.findByText('₹65,857')).toBeInTheDocument()
    expect(screen.getByText('₹73,000')).toBeInTheDocument()
    expect(screen.getByText('Latest')).toBeInTheDocument()
  })

  it('says so when there are none yet', async () => {
    API.get.mockResolvedValue({ data: { payslips: [] } })

    at('/payslips', <Payslips />)

    expect(await screen.findByText('No payslips yet')).toBeInTheDocument()
  })

  it('opens a slip with every line, the net in words, and a PDF button', async () => {
    API.get.mockResolvedValue({ data: { payslip: slip() } })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})

    at('/payslips/s1', <Payslips />)

    expect(await screen.findByText('Loss of pay')).toBeInTheDocument()
    expect(screen.getByText('2 days · 2 unpaid leave')).toBeInTheDocument()
    expect(screen.getByText(/Rupees Sixty Five Thousand Eight Hundred Fifty Seven only/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /download pdf/i }))
    expect(print).toHaveBeenCalled()
    print.mockRestore()
  })
})

describe('running payroll', () => {
  const month = (over = {}) => ({
    month: '2026-08',
    today: '2026-09-17',
    isFuture: false,
    rows: [
      {
        user: { _id: 'u1', name: 'Asha Rao', position: 'Backend engineer', team: 'MERN' },
        monthly: 75000,
        currency: 'INR',
        slip: null,
        preview: { gross: 75000, net: 65857, lossOfPayDays: 2 }
      }
    ],
    counts: { people: 1, drafts: 0, published: 0, notRun: 1, withoutSalary: 2 },
    totals: { gross: 75000, net: 65857, deductions: 9143 },
    ...over
  })

  it('shows an estimate before the run, and who is left out', async () => {
    API.get.mockResolvedValue({ data: month() })

    at('/workspace/payroll', <Payroll />)

    expect(await screen.findByText('estimate')).toBeInTheDocument()
    expect(screen.getByText(/2 people have no salary on record/)).toBeInTheDocument()
  })

  it('generates the month, then asks before publishing', async () => {
    API.get
      .mockResolvedValueOnce({ data: month() })
      .mockResolvedValue({
        data: month({
          rows: [{ ...month().rows[0], slip: { _id: 's1', status: 'draft', gross: 75000, net: 65857, lossOfPayDays: 2 } }],
          counts: { people: 1, drafts: 1, published: 0, notRun: 0, withoutSalary: 2 }
        })
      })
    API.post.mockResolvedValue({ data: { message: 'Done' } })

    at('/workspace/payroll', <Payroll />)
    await userEvent.click(await screen.findByRole('button', { name: /generate payslips/i }))
    expect(API.post).toHaveBeenCalledWith('/payslips/run', { month: '2026-08' })

    await userEvent.click(await screen.findByRole('button', { name: /publish 1/i }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/is not worked out again/)).toBeInTheDocument()
    await userEvent.click(dialog.getByRole('button', { name: /^publish$/i }))

    await waitFor(() => expect(API.post).toHaveBeenLastCalledWith('/payslips/publish', { month: '2026-08' }))
  })
})
