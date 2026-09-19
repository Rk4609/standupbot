import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))

import API from '../api/axios'
import CompanySettings from '../pages/CompanySettings'
import { workingDays } from '../lib/leave'

const settings = {
  office: { start: '10:00', graceMinutes: 15, fullDayHours: 8, halfDayHours: 4 },
  leave: { casual: 12, sick: 8, earned: 15 },
  pay: { basicPercent: 50, hraPercent: 20, pfRate: 12, pfWageCeiling: 15000, professionalTax: 200, professionalTaxFrom: 15000 },
  holidays: [],
  canEdit: true
}

beforeEach(() => {
  API.get.mockReset()
  API.put.mockReset()
  API.get.mockResolvedValue({ data: settings })
  API.put.mockResolvedValue({ data: {} })
})

describe('company settings', () => {
  it('saves leave allowances as numbers', async () => {
    render(<CompanySettings />)
    const earned = await screen.findByLabelText('Earned')
    await userEvent.clear(earned)
    await userEvent.type(earned, '20')
    await userEvent.click(screen.getByRole('button', { name: 'Save leave' }))

    await waitFor(() => expect(API.put).toHaveBeenCalledWith('/settings', { leave: { casual: 12, sick: 8, earned: 20 } }))
  })

  it('adds the India list without repeating a day, and saves it', async () => {
    render(<CompanySettings />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add India 2026 list' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add India 2026 list' }))

    expect(screen.getByText('Diwali')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save holidays (12)' }))
    const sent = API.put.mock.calls[0][1].holidays
    expect(sent).toHaveLength(12)
    expect(sent.find(h => h.name === 'Gandhi Jayanti').date).toBe('2026-10-02')
  })

  it('counts leave days without holidays on the client too', () => {
    expect(workingDays('2026-09-28', '2026-10-02', false, [{ date: '2026-10-02', name: 'Gandhi Jayanti' }])).toBe(4)
  })
})
