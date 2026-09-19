/**
 * One set of page sizes for every list in the app.
 *
 * PAGE_SIZES is what the lists offer. A few older sizes are still accepted
 * so a link or a saved tab asking for 25 or 50 keeps working.
 */
const PAGE_SIZES = [10, 20, 40, 100]
const ACCEPTED = [10, 20, 25, 40, 50, 100]

/** page, limit and skip from ?page=&limit=, falling back when either is missing or odd. */
const paging = (query = {}, fallback = 10) => {
  const limit = ACCEPTED.includes(Number(query.limit)) ? Number(query.limit) : fallback
  const page = Math.max(1, Math.floor(Number(query.page)) || 1)
  return { page, limit, skip: (page - 1) * limit }
}

/** What a paged response says about itself. */
const pageInfo = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  pageSizes: PAGE_SIZES
})

module.exports = { PAGE_SIZES, ACCEPTED, paging, pageInfo }
