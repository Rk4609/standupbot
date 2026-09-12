import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from '../components/ui/Pagination'

const setup = (props = {}) => {
  const onPage = vi.fn()
  render(
    <Pagination
      page={1}
      totalPages={5}
      total={63}
      limit={10}
      onPage={onPage}
      {...props}
    />
  )
  return { onPage }
}

const pageButtons = () =>
  screen.getAllByRole('button')
    .map(b => b.textContent.trim())
    .filter(t => /^\d+$/.test(t))

describe('Pagination', () => {
  it('reports the range currently on screen', () => {
    setup({ page: 3, limit: 10, total: 63 })
    expect(screen.getByText('Showing 21–30 of 63')).toBeInTheDocument()
  })

  it('does not overstate the range on the last, partial page', () => {
    setup({ page: 7, totalPages: 7, limit: 10, total: 63 })
    expect(screen.getByText('Showing 61–63 of 63')).toBeInTheDocument()
  })

  it('renders nothing at all when there is no data', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={0} limit={10} onPage={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('hides the page controls when everything fits on one page', () => {
    setup({ page: 1, totalPages: 1, total: 8 })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1–8 of 8')).toBeInTheDocument()
  })

  it('lists every page while there are few of them', () => {
    setup({ totalPages: 5 })
    expect(pageButtons()).toEqual(['1', '2', '3', '4', '5'])
  })

  it('collapses the middle with ellipses once there are many pages', () => {
    setup({ page: 10, totalPages: 20 })

    // First and last stay reachable, with a window around the current page
    expect(pageButtons()).toEqual(['1', '9', '10', '11', '20'])
    expect(screen.getAllByText('…')).toHaveLength(2)
  })

  it('keeps the first pages visible without a leading ellipsis', () => {
    setup({ page: 2, totalPages: 20 })
    expect(pageButtons()).toEqual(['1', '2', '3', '20'])
    expect(screen.getAllByText('…')).toHaveLength(1)
  })

  it('marks the current page for assistive tech', () => {
    setup({ page: 3, totalPages: 5 })
    expect(screen.getByRole('button', { current: 'page' })).toHaveTextContent('3')
  })

  it('disables Prev on the first page and Next on the last', () => {
    const { unmount } = render(
      <Pagination page={1} totalPages={5} total={50} limit={10} onPage={vi.fn()} />
    )
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    expect(screen.getByLabelText('Next page')).toBeEnabled()
    unmount()

    render(<Pagination page={5} totalPages={5} total={50} limit={10} onPage={vi.fn()} />)
    expect(screen.getByLabelText('Previous page')).toBeEnabled()
    expect(screen.getByLabelText('Next page')).toBeDisabled()
  })

  it('asks for the next and previous page by number', async () => {
    const user = userEvent.setup()
    const { onPage } = setup({ page: 3, totalPages: 5 })

    await user.click(screen.getByLabelText('Next page'))
    expect(onPage).toHaveBeenCalledWith(4)

    await user.click(screen.getByLabelText('Previous page'))
    expect(onPage).toHaveBeenCalledWith(2)
  })

  it('jumps straight to a page that is clicked', async () => {
    const user = userEvent.setup()
    const { onPage } = setup({ page: 1, totalPages: 5 })

    await user.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onPage).toHaveBeenCalledWith(4)
  })

  it('ignores clicks on a disabled control', async () => {
    const user = userEvent.setup()
    const { onPage } = setup({ page: 1, totalPages: 5 })

    await user.click(screen.getByLabelText('Previous page'))
    expect(onPage).not.toHaveBeenCalled()
  })
})
