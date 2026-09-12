import Card from './ui/Card'
import EmptyState from './ui/EmptyState'
import { IconTimer } from './ui/icons'
import { cn } from '../lib/cn'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

/**
 * One week of booked hours: a row per project, a column per working day.
 *
 * Shown to the person who filled it in and to the manager reviewing it, so it
 * lives here rather than in either page.
 */
export default function WeekGrid({ data }) {
  if (data.lines.length === 0) {
    return (
      <EmptyState
        icon={<IconTimer className="h-6 w-6" />}
        title="No hours in this week"
        description="Hours are entered with your daily standup, so fill one in and they land here."
      />
    )
  }

  return (
    <Card padded={false}>
      <div className="scroll-slim overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-5 py-3 text-left font-medium">Project</th>
              {data.dates.map((date, i) => (
                <th key={date} className="eyebrow px-2 py-3 text-right font-medium">
                  {DAY_NAMES[i]}
                  <span className="block font-normal normal-case text-content-subtle">
                    {date.slice(8)}
                  </span>
                </th>
              ))}
              <th className="eyebrow px-5 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {data.lines.map(line => (
              <tr key={String(line.project)}>
                <td className="px-5 py-3">
                  <span className="block text-content">{line.name}</span>
                  <span className="block text-xs text-content-subtle">
                    {line.client || 'Internal'}
                    {!line.billable && ' · non-billable'}
                  </span>
                </td>
                {data.dates.map(date => (
                  <td
                    key={date}
                    className={cn(
                      'tabular px-2 py-3 text-right',
                      line.perDay[date] ? 'text-content' : 'text-content-subtle'
                    )}
                  >
                    {line.perDay[date] || '—'}
                  </td>
                ))}
                <td className="tabular px-5 py-3 text-right font-semibold text-content">
                  {line.total}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-line bg-surface-sunken">
              <td className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-content-subtle">
                Total
              </td>
              {data.dates.map(date => (
                <td key={date} className="tabular px-2 py-3 text-right text-content">
                  {data.perDayTotals[date] || '—'}
                </td>
              ))}
              <td className="tabular px-5 py-3 text-right font-bold text-content">
                {data.totalHours}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
