import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { SPRING } from '../lib/motion'
import { todayForUser } from '../lib/timezone'

const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['M', '', 'W', '', 'F', '', '']

/**
 * Columns of 7 days, oldest first, each column starting on a Monday.
 *
 * Every cell is addressed by the same 'YYYY-MM-DD' key the server stores.
 * Taking local midnight and calling `toISOString()` on it — as this did —
 * shifts that key a day back for every zone ahead of UTC, so an Indian user's
 * grid lit up the wrong squares.
 */
function buildGrid(weeks) {
  const today = todayForUser()
  const anchor = new Date(`${today}T00:00:00.000Z`)

  const dow = (anchor.getUTCDay() + 6) % 7 // 0 = Monday
  const start = new Date(anchor.getTime() - (dow + (weeks - 1) * 7) * DAY_MS)

  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY_MS)
      const key = date.toISOString().split('T')[0]
      return { key, date, future: key > today }
    })
  )
}

/**
 * Contribution-style grid of submitted days. Gives the page a piece of dense,
 * at-a-glance history instead of another row of single-number tiles.
 */
export default function StreakHeatmap({ dates = [], weeks = 18, className }) {
  const submitted = new Set(dates)
  const columns = buildGrid(weeks)
  const done = columns.flat().filter(c => submitted.has(c.key)).length

  // A month label sits above the first column that falls in a new month
  const monthLabels = columns.map((col, i) => {
    const m = col[0].date.getMonth()
    const prev = i > 0 ? columns[i - 1][0].date.getMonth() : null
    return i === 0 || m !== prev ? MONTHS[m] : ''
  })

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Month scale */}
          <div className="mb-1.5 flex gap-1 pl-5">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="w-[13px] shrink-0 text-[10px] leading-none text-content-subtle"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Weekday scale */}
            <div className="mr-1 flex flex-col gap-1">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="flex h-[13px] w-3 items-center text-[10px] leading-none text-content-subtle"
                >
                  {d}
                </span>
              ))}
            </div>

            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {col.map((cell, di) => {
                  const filled = submitted.has(cell.key)
                  return (
                    <motion.div
                      key={cell.key}
                      title={`${cell.key}${filled ? ' · submitted' : ''}`}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: cell.future ? 0.3 : 1, scale: 1 }}
                      transition={{ delay: Math.min((ci * 7 + di) * 0.003, 0.45), ...SPRING }}
                      className={cn(
                        'h-[13px] w-[13px] shrink-0 rounded-[3px]',
                        filled
                          ? 'bg-brand-500 ring-1 ring-inset ring-brand-600/30'
                          : 'bg-surface-sunken dark:bg-white/[0.055]'
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-content-subtle">
        <span>
          <span className="tabular font-medium text-content">{done}</span> submitted in the
          last {weeks} weeks
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          Less
          <span className="h-[11px] w-[11px] rounded-[3px] bg-surface-sunken dark:bg-white/[0.055]" />
          <span className="h-[11px] w-[11px] rounded-[3px] bg-brand-500/45" />
          <span className="h-[11px] w-[11px] rounded-[3px] bg-brand-500" />
          More
        </span>
      </div>
    </div>
  )
}
