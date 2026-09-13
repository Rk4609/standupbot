/** A Date, an ISO string or nothing → what a `type="date"` input wants. */
export const asDateInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** The same value, written the way a person reads a date. */
export const prettyDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
