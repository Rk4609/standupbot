import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NotificationToast from '../components/NotificationToast'

const notification = (over = {}) => ({
  _id: 'n1',
  type: 'support_raised',
  message: 'Asha Rao reported: The export button does nothing',
  link: '/support',
  createdAt: '2026-09-13T09:00:00.000Z',
  ...over
})

const show = (over = {}, onOpen = vi.fn()) => {
  render(
    <NotificationToast
      t={{ id: 't1', visible: true }}
      notification={notification(over)}
      onOpen={onOpen}
    />
  )
  return onOpen
}

describe('the popup that says something arrived', () => {
  it('names the kind of thing, not just the sentence', () => {
    show()

    expect(screen.getByText('New issue reported')).toBeInTheDocument()
    expect(screen.getByText(/Asha Rao reported/)).toBeInTheDocument()
  })

  it('reads differently to the person who is answered', () => {
    show({ type: 'support_replied', message: 'The Admin answered: Export' })

    expect(screen.getByText('Your report was answered')).toBeInTheDocument()
  })

  it('takes you to it', async () => {
    const onOpen = show()

    await userEvent.click(screen.getByRole('button', { name: /new issue reported/i }))

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ link: '/support' }))
  })

  it('can be waved away without going anywhere', async () => {
    const onOpen = show()

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(onOpen).not.toHaveBeenCalled()
  })

  it('still says something for a kind it has never seen', () => {
    show({ type: 'something_new', message: 'A thing happened' })

    expect(screen.getByText('Notification')).toBeInTheDocument()
    expect(screen.getByText('A thing happened')).toBeInTheDocument()
  })
})
