import { motion, AnimatePresence } from 'framer-motion'
import Button from './ui/Button'
import { Input, Select } from './ui/Field'
import { IconPlus, IconTrash } from './ui/icons'
import { cn } from '../lib/cn'
import { DURATION, EASE } from '../lib/motion'

const round = (n) => Number((n || 0).toFixed(2))

/**
 * Where the day's hours went.
 *
 * One row per piece of work rather than one per project: two hours on the
 * same project for two different reasons are two things the person did, and
 * collapsing them loses the only part a reader cares about.
 */
export default function WorkEntries({ projects, rows, onChange, dayLabel = 'today' }) {
  const total = round(rows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0))
  const overfull = total > 24

  const patch = (i, changes) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...changes } : r)))

  const add = () =>
    onChange([...rows, { project: projects[0]?._id || '', hours: '', note: '' }])

  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i))

  if (projects.length === 0) {
    return (
      <p className="text-sm text-content-muted">
        There are no projects to book against yet. Ask your manager to add one.
      </p>
    )
  }

  return (
    <div>
      <ul className="space-y-2.5">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE }}
              className="flex flex-wrap items-start gap-2 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <Select
                  value={row.project}
                  onChange={e => patch(i, { project: e.target.value })}
                  aria-label={`Project for entry ${i + 1}`}
                  className="py-2 text-sm"
                >
                  <option value="">Choose a project…</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.code ? `${p.code} · ` : ''}{p.name}
                      {p.client ? ` (${p.client})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-24 shrink-0">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={row.hours}
                  onChange={e => patch(i, { hours: e.target.value })}
                  placeholder="Hours"
                  aria-label={`Hours for entry ${i + 1}`}
                  className="py-2 text-sm"
                />
              </div>

              <div className="min-w-0 flex-1">
                <Input
                  value={row.note}
                  onChange={e => patch(i, { note: e.target.value })}
                  placeholder="What on it? (optional)"
                  aria-label={`Note for entry ${i + 1}`}
                  maxLength={500}
                  className="py-2 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove entry ${i + 1}`}
                className="mt-1 shrink-0 rounded-md p-1.5 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={add} disabled={rows.length >= 20}>
          <IconPlus className="h-4 w-4" />
          Add a row
        </Button>

        <p className={cn('tabular text-sm', overfull ? 'text-red-500' : 'text-content-muted')}>
          <span className="font-semibold text-content">{total}</span> hours {dayLabel}
          {overfull && ' — more than a day'}
        </p>
      </div>
    </div>
  )
}
