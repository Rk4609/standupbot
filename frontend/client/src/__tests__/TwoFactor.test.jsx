import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import API from '../api/axios'
import Login from '../pages/Login'
import TwoFactorSettings from '../components/TwoFactorSettings'

beforeEach(() => {
  API.get.mockReset()
  API.post.mockReset()
  localStorage.clear()
})

describe('signing in with a second step', () => {
  it('asks for the code after the password, then signs in', async () => {
    const setUser = vi.fn()
    API.post
      .mockResolvedValueOnce({ data: { twoFactorRequired: true, challenge: 'challenge-token-that-is-long-enough' } })
      .mockResolvedValueOnce({ data: { _id: 'u1', name: 'Asha', token: 'session' } })

    render(<MemoryRouter><Login setUser={setUser} /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText('you@company.com'), 'asha@acme.test')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByLabelText('Code')).toBeInTheDocument()
    expect(setUser).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Code'), '287082')
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }))

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ token: 'session' })))
    expect(API.post).toHaveBeenLastCalledWith('/auth/login/2fa', { challenge: 'challenge-token-that-is-long-enough', code: '287082' })
  })
})

describe('two-step sign-in on the profile', () => {
  it('turns on: shows the QR code, confirms a code, and shows recovery codes once', async () => {
    API.get.mockResolvedValue({ data: { enabled: false, required: true, recoveryLeft: 0 } })
    API.post
      .mockResolvedValueOnce({ data: { secret: 'JBSWY3DPEHPK3PXP', qr: 'data:image/png;base64,AAAA', otpauthUrl: 'otpauth://totp/x' } })
      .mockResolvedValueOnce({ data: { recoveryCodes: ['aaaaa-11111', 'bbbbb-22222'] } })

    render(<TwoFactorSettings />)
    expect(await screen.findByText('Needed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }))
    expect(await screen.findByAltText(/QR code/)).toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Code from the app'), '123456')
    await userEvent.click(screen.getAllByRole('button', { name: 'Turn on' }).at(-1))

    expect(await screen.findByText('aaaaa-11111')).toBeInTheDocument()
    expect(API.post).toHaveBeenLastCalledWith('/auth/2fa/enable', { code: '123456' })
  })
})
