import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { Input } from './ui/Field'
import { IconCheck, IconPlus, IconTrash } from './ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { shortDay } from '../lib/leave'

const GROUPS = [
  { owner: 'hr', title: 'HR', hint: 'Paperwork, pay and accounts' },
  { owner: 'manager', title: 'Manager', hint: 'Equipment, people and first goals' },
  { owner: 'employee', title: 'Joiner', hint: 'Their own first steps' }
]

/**
 * The tasks, grouped by whose job they are.
 *
 * Only the boxes this reader may tick are live; the rest show who ticked
 * them and when. Changes go straight to the server and the list is replaced
 * with what it sends back, so two people ticking at once end up agreeing.
 */
export default function OnboardingChecklist({ onboarding, onChange, viewerIsJoiner = false }) {
  const [busy, setBusy] = useState(null)
  const [adding, setAdding] = useState(null)
  const [draft, setDraft] = useState({ title: '', dueOn: '' })

  const base = `/onboarding/${onboarding._id}/tasks`

  const run = async (key, request) => {
    setBusy(key)
    try {
      const { data } = await request()
      onChange(data.onboarding)
      return true
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That did not save'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const add = (owner) => (e) => {
    e.preventDefault()
    run(`add-${owner}`, () => API.post(base, { title: draft.title.trim(), owner, dueOn: draft.dueOn }))
      .then(saved => {
        // A refused task keeps the form open with what was typed
        if (!saved) return
        setAdding(null)
        setDraft({ title: '', dueOn: '' })
      })
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(group => {
        const tasks = onboarding.tasks
          .filter(t => t.owner === group.owner)
          .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
        const done = tasks.filter(t => t.done).length
        const title = group.owner === 'employee' && viewerIsJoiner ? 'You' : group.title

        return (
          <section key={group.owner} className="rounded-card border border-line/70 bg-surface/85 shadow-card">
            <header className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5">
              <div>
                <h2 className="text-sm font-semibold text-content">{title}</h2>
                <p className="text-xs text-content-subtle">{group.hint}</p>
              </div>
              <span className="tabular text-xs text-content-muted">{done}/{tasks.length}</span>
            </header>

            <ul className="mt-2 divide-y divide-line/70">
              {tasks.map(task => (
                <li key={task._id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={task.done}
                    aria-label={task.title}
                    disabled={!task.canTick || busy === task._id}
                    onClick={() => run(task._id, () => API.patch(`${base}/${task._id}`, { done: !task.done }))}
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                      task.done
                        ? 'border-transparent bg-emerald-500 text-white'
                        : 'border-line bg-surface hover:border-brand-400',
                      !task.canTick && 'cursor-default opacity-70 hover:border-line'
                    )}
                  >
                    {task.done && <IconCheck className="h-3.5 w-3.5" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', task.done ? 'text-content-subtle line-through' : 'text-content')}>
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs text-content-subtle">
                      {task.done
                        ? `Done by ${task.doneByName || 'someone'}${task.doneAt ? ` · ${new Date(task.doneAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}`
                        : `Due ${shortDay(task.dueOn)}`}
                    </p>
                  </div>

                  {task.overdue && <Badge tone="danger">Overdue</Badge>}
                  {onboarding.canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${task.title}`}
                      disabled={busy === `rm-${task._id}`}
                      onClick={() => run(`rm-${task._id}`, () => API.delete(`${base}/${task._id}`))}
                      className="rounded-full p-1.5 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-600"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="px-4 py-3 text-sm text-content-subtle md:px-5">Nothing for {title.toLowerCase()} on this list.</li>
              )}
            </ul>

            {onboarding.canEdit && (
              adding === group.owner ? (
                <form onSubmit={add(group.owner)} className="flex flex-col gap-2 border-t border-line/70 px-4 py-3 sm:flex-row md:px-5">
                  <Input
                    autoFocus
                    value={draft.title}
                    onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                    placeholder="What needs doing"
                    aria-label="Task"
                    maxLength={120}
                    className="py-2 text-sm"
                  />
                  <Input
                    type="date"
                    value={draft.dueOn}
                    onChange={e => setDraft(d => ({ ...d, dueOn: e.target.value }))}
                    aria-label="Due"
                    className="py-2 text-sm sm:w-44"
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
                    <Button
                      type="submit"
                      size="sm"
                      loading={busy === `add-${group.owner}`}
                      disabled={draft.title.trim().length < 3 || !draft.dueOn}
                    >
                      Add
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-line/70 px-4 py-2 md:px-5">
                  <button
                    type="button"
                    onClick={() => { setAdding(group.owner); setDraft({ title: '', dueOn: '' }) }}
                    className="flex items-center gap-1.5 py-1 text-xs text-content-muted hover:text-content"
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                    Add a task for {title.toLowerCase()}
                  </button>
                </div>
              )
            )}
          </section>
        )
      })}
    </div>
  )
}
