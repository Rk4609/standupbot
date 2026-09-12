import { motion } from 'framer-motion'
import { cn } from '../../lib/cn'
import { SPRING } from '../../lib/motion'

/**
 * Page numbers with ellipses: always the first and last page, plus a window
 * around the current one, so the control stays a fixed width at any scale.
 */
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = [1]
  const from = Math.max(2, current - 1)
  const to = Math.min(total - 1, current + 1)

  if (from > 2) pages.push('…')
  for (let p = from; p <= to; p++) pages.push(p)
  if (to < total - 1) pages.push('…')
  pages.push(total)

  return pages
}

function PageButton({ active, disabled, onClick, children, label }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={SPRING}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-sm transition-colors',
        active
          ? 'bg-brand-600 font-medium text-white'
          : 'text-content-muted hover:bg-surface-sunken hover:text-content',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-content-muted'
      )}
    >
      {children}
    </motion.button>
  )
}

export default function Pagination({ page, totalPages, total, limit, onPage, className }) {
  if (total === 0) return null

  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 sm:flex-row',
        className
      )}
    >
      <p className="tabular text-xs text-content-subtle">
        Showing {first}–{last} of {total}
      </p>

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PageButton
            label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            ‹ Prev
          </PageButton>

          {pageList(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-content-subtle">
                …
              </span>
            ) : (
              <PageButton
                key={p}
                label={`Page ${p}`}
                active={p === page}
                onClick={() => onPage(p)}
              >
                {p}
              </PageButton>
            )
          )}

          <PageButton
            label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next ›
          </PageButton>
        </nav>
      )}
    </div>
  )
}
