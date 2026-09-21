import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Badge from './ui/Badge'
import { Select } from './ui/Field'
import { IconClose, IconPlus, IconUsers } from './ui/icons'
import { cn } from '../lib/cn'
import { DURATION, EASE } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

/**
 * Who works on one project, and moving people on and off it.
 *
 * A project with nobody named is open to its whole team — that is how every
 * project behaved before anyone could be assigned, and the panel says so
 * rather than showing an empty list that looks like a mistake.
 */
export default function ProjectMembers({ project, assignable, projects, onChanged }) {
  const [members, setMembers] = useState(project.members || [])
  const [adding, setAdding] = useState('')
  const [moving, setMoving] = useState(null)
  const [busy, setBusy] = useState(false)

  const memberIds = new Set(members.map(m => String(m._id)))
  const canAdd = assignable.filter(p => !memberIds.has(String(p._id)))
  const elsewhere = projects.filter(p => String(p._id) !== String(project._id) && p.active)

  const add = async () => {
    if (!adding) return
    setBusy(true)
    try {
      const { data } = await API.patch(`/projects/${project._id}/members`, { add: [adding] })
      setMembers(data.members)
      setAdding('')
      onChanged?.()
      toast.success('Added to the project')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not add them'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (person) => {
    setBusy(true)
    try {
      const { data } = await API.patch(`/projects/${project._id}/members`, {
        remove: [String(person._id)]
      })
      setMembers(data.members)
      onChanged?.()
      toast.success(`${person.name} taken off`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not remove them'))
    } finally {
      setBusy(false)
    }
  }

  const transfer = async (person, toProject) => {
    setBusy(true)
    try {
      const { data } = await API.post(`/projects/${project._id}/transfer`, {
        user: String(person._id),
        toProject
      })
      setMembers(m => m.filter(x => String(x._id) !== String(person._id)))
      setMoving(null)
      onChanged?.()
      toast.success(data.message)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not move them'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {members.length === 0 ? (
        <div className="flex gap-2.5 rounded-xl border border-line bg-surface-sunken px-3.5 py-3">
          <IconUsers className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" />
          <p className="text-sm text-content-muted">
            Nobody is named on this project, so the whole team works on it.
            Add one person and it becomes theirs.
          </p>
        </div>
      ) : (
        <ul
          className={cn(
            'divide-y divide-line rounded-xl border border-line',
            // A twenty-person project would otherwise push the rest of the
            // list off the screen
            members.length > 8 && 'scroll-slim max-h-96 overflow-y-auto'
          )}
        >
          <AnimatePresence initial={false}>
            {members.map(person => (
              <motion.li
                key={person._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600/12 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {person.name?.charAt(0).toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-content">{person.name}</span>
                    <span className="block truncate text-xs text-content-subtle">
                      {person.email}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setMoving(moving === person._id ? null : person._id)}
                    disabled={busy || elsewhere.length === 0}
                    className="rounded-md px-2 py-1 text-xs text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content disabled:opacity-40"
                  >
                    Move
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(person)}
                    disabled={busy}
                    aria-label={`Take ${person.name} off this project`}
                    className="rounded-md p-1 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {moving === person._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: DURATION.fast, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-line bg-surface-sunken/50 px-3.5 py-3">
                        <p className="mb-2 text-xs text-content-subtle">
                          Move {person.name} to another project. They come off this
                          one and go on the one you pick.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <div className="min-w-0 flex-1">
                            <Select
                              defaultValue=""
                              aria-label={`Move ${person.name} to`}
                              className="py-2 text-sm"
                              onChange={e => e.target.value && transfer(person, e.target.value)}
                            >
                              <option value="">Choose a project…</option>
                              {elsewhere.map(p => (
                                <option key={p._id} value={p._id}>
                                  {p.code ? `${p.code} · ` : ''}{p.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <Button variant="ghost" onClick={() => setMoving(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Select
            value={adding}
            onChange={e => setAdding(e.target.value)}
            aria-label={`Add somebody to ${project.name}`}
            className="py-2 text-sm"
            disabled={canAdd.length === 0}
          >
            <option value="">
              {canAdd.length === 0 ? 'Everybody is already on this' : 'Add somebody…'}
            </option>
            {canAdd.map(p => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={!adding || busy}
          className={cn('shrink-0')}
        >
          <IconPlus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {members.length > 0 && (
        <p className="text-xs text-content-subtle">
          <Badge tone="brand">{members.length}</Badge>{' '}
          {members.length === 1 ? 'person works' : 'people work'} on this project.
          Nobody else is on it.
        </p>
      )}
    </div>
  )
}
