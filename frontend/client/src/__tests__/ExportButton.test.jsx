import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }))

import API from '../api/axios'
import ExportButton from '../components/ExportButton'

beforeEach(() => {
  API.get.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:csv')
  URL.revokeObjectURL = vi.fn()
})

describe('exporting', () => {
  it('fetches the file with the sign-in and saves it under the server\'s name', async () => {
    API.get.mockResolvedValue({
      data: new Blob(['"Name"']),
      headers: { 'content-disposition': 'attachment; filename="attendance-2026-09.csv"' }
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<ExportButton path="/exports/attendance" params={{ month: '2026-09' }} label="Export month" />)
    await userEvent.click(screen.getByRole('button', { name: 'Export month' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(API.get).toHaveBeenCalledWith('/exports/attendance', { params: { month: '2026-09' }, responseType: 'blob' })
    expect(click.mock.instances[0].download).toBe('attendance-2026-09.csv')
    click.mockRestore()
  })
})
