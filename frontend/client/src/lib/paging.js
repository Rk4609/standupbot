import { useMemo, useState } from 'react'

/** The sizes every list offers. */
export const PAGE_SIZES = [10, 20, 40, 100]
export const DEFAULT_PAGE_SIZE = 10

const storageKey = (key) => `pageSize:${key}`

const readSize = (key, fallback) => {
  try {
    const saved = Number(window.localStorage.getItem(storageKey(key)))
    return PAGE_SIZES.includes(saved) ? saved : fallback
  } catch {
    return fallback
  }
}

/**
 * How many rows this list shows, remembered per list in this browser, so
 * somebody who likes 40 at a time does not pick it again on every visit.
 */
export function usePageSize(key, fallback = DEFAULT_PAGE_SIZE) {
  const [size, setSize] = useState(() => readSize(key, fallback))
  const change = (next) => {
    setSize(next)
    try {
      window.localStorage.setItem(storageKey(key), String(next))
    } catch {
      // Private window or blocked storage: it just is not remembered
    }
  }
  return [size, change]
}

/**
 * Paging for a list the server sends whole: the rows on this page, and what
 * the Pagination control needs. Goes back to page 1 when the size changes,
 * and never sits past the end when the list gets shorter.
 */
export function usePaged(items, key, fallback = DEFAULT_PAGE_SIZE) {
  const [size, setSize] = usePageSize(key, fallback)
  const [page, setPage] = useState(1)
  const list = useMemo(() => items || [], [items])
  const total = list.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(page, totalPages)

  return {
    rows: list.slice((current - 1) * size, current * size),
    page: current,
    // From where the reader actually is, so a list that shrank does not strand them
    setPage: (next) => setPage(typeof next === 'function' ? next(current) : next),
    size,
    setSize: (next) => { setSize(next); setPage(1) },
    total,
    totalPages
  }
}
