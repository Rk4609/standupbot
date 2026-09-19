import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import Documents from '../pages/Documents'
import Letters from '../pages/Letters'
import LetterDocument from '../components/LetterDocument'
import VerifyLetter from '../pages/VerifyLetter'

const issued = {
  _id: 'l1',
  type: 'employment',
  status: 'issued',
  number: 'KT/2026/0001',
  code: 'ABCD-EFGH',
  issuedOn: '2026-09-17',
  userName: 'Asha Verma',
  title: 'Employment certificate',
  body: ['This is to certify that Asha Verma is employed with Kamsora Tech.', 'This letter is issued at the request of the employee.'],
  addressedTo: '',
  company: { name: 'Kamsora Tech', address: 'Jaipur', email: '', phone: '', signatory: 'R. Jangid', signatoryTitle: 'Director' }
}

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  for (const fn of Object.values(API)) fn.mockReset()
})

describe('my documents', () => {
  it('lists issued letters and asks HR for a new one', async () => {
    API.get.mockResolvedValue({ data: { letters: [issued, { ...issued, _id: 'l2', status: 'declined', type: 'relieving', note: 'You are still with us' }], types: ['employment', 'salary', 'experience', 'relieving'] } })
    API.post.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    inRouter(<Documents />)

    expect(await screen.findByText('KT/2026/0001 · 17 September 2026')).toBeInTheDocument()
    expect(screen.getByText('You are still with us')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ask for a letter/ }))
    await user.selectOptions(screen.getByLabelText('Which letter'), 'salary')
    await user.type(screen.getByLabelText('What it is for'), 'a home loan')
    await user.click(screen.getByRole('button', { name: 'Send to HR' }))

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/letters/request', { type: 'salary', purpose: 'a home loan' }))
  })
})

describe('HR letters desk', () => {
  it('asks for the last day before issuing a relieving letter', async () => {
    API.get.mockResolvedValue({
      data: {
        letters: [{ _id: 'r1', userName: 'Asha Verma', type: 'relieving', status: 'requested', purpose: '' }],
        waiting: 1, types: ['employment', 'salary', 'experience', 'relieving'], canSalary: true, page: 1, totalPages: 1, total: 1
      }
    })
    API.post.mockResolvedValue({ data: { letter: { _id: 'r1' }, message: 'done' } })
    const user = userEvent.setup()
    inRouter(<Letters />)

    expect(await screen.findByText('1 request waiting')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Issue' }))
    const issue = screen.getByRole('button', { name: 'Issue letter' })
    expect(issue).toBeDisabled()
    await user.type(screen.getByLabelText('Last working day'), '2026-09-30')
    await user.click(issue)

    await waitFor(() => expect(API.post).toHaveBeenCalledWith('/letters/r1/issue', { lastDay: '2026-09-30' }))
  })

  it('does not offer salary requests to somebody without pay', async () => {
    API.get.mockResolvedValue({
      data: {
        letters: [{ _id: 's1', userName: 'Asha Verma', type: 'salary', status: 'requested', purpose: '' }],
        waiting: 1, types: ['employment', 'salary'], canSalary: false, page: 1, totalPages: 1, total: 1
      }
    })
    inRouter(<Letters />)

    expect(await screen.findByText('With HR')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument()
  })
})

describe('the letter', () => {
  it('prints what the server wrote, the signatory and the verification code', () => {
    render(<LetterDocument letter={issued} />)

    expect(screen.getByText('To whomsoever it may concern')).toBeInTheDocument()
    expect(screen.getByText('This is to certify that Asha Verma is employed with Kamsora Tech.')).toBeInTheDocument()
    expect(screen.getByText('R. Jangid')).toBeInTheDocument()
    expect(screen.getByText(/verify\/ABCD-EFGH — code ABCD-EFGH/)).toBeInTheDocument()
  })

  it('verifies a code in public, and says so when it is unknown', async () => {
    API.get.mockResolvedValueOnce({ data: { valid: true, number: 'KT/2026/0001', title: 'Employment certificate', name: 'Asha Verma', issuedOn: '2026-09-17', company: 'Kamsora Tech' } })
    const { unmount } = render(
      <MemoryRouter initialEntries={['/verify/ABCD-EFGH']}><Routes><Route path="/verify/:code" element={<VerifyLetter />} /></Routes></MemoryRouter>
    )
    expect(await screen.findByText('This letter is genuine')).toBeInTheDocument()
    expect(screen.getByText('Asha Verma')).toBeInTheDocument()
    unmount()

    API.get.mockRejectedValueOnce({ response: { status: 404 } })
    render(
      <MemoryRouter initialEntries={['/verify/ZZZZ-ZZZZ']}><Routes><Route path="/verify/:code" element={<VerifyLetter />} /></Routes></MemoryRouter>
    )
    expect(await screen.findByText('No letter has this code.')).toBeInTheDocument()
  })
})
