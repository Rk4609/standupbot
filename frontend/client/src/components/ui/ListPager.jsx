import Pagination from './Pagination'

/**
 * The footer under a list paged with usePaged: "Showing 1–10 of 34" and the
 * page buttons. Nothing when the list fits on one page at the smallest size.
 */
export default function ListPager({ paged, className = 'border-t border-line px-4 py-3 md:px-6' }) {
  if (paged.total <= 10) return null
  return (
    <div className={className}>
      <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} limit={paged.size} onPage={paged.setPage} />
    </div>
  )
}
