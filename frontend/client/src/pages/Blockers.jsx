import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Field'
import { IconAlert, IconCheck, IconHourglass, IconPencil, IconTrash } from '../components/ui/icons'
import { DURATION, EASE, collapseVariants } from '../lib/motion'

const loadBlockers = () => API.get('/standups/blockers').then(res => res.data)

const errorMessage = (err) =>
  err.response?.data?.message || 'Could not load blockers'

/** Whole days between a standup date and today. */
const ageInDays = (dateStr) => {
  const then = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now - then) / 86_400_000))
}

export default function Blockers({ user }) {
  const [blockers, setBlockers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    loadBlockers()
      .then(data => {
        if (!cancelled) setBlockers(data)
      })
      .catch(err => {
        console.error(err)
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Silent refetch after an edit — no skeleton, the list is already on screen. */
  const refresh = async () => {
    try {
      setError('')
      setBlockers(await loadBlockers())
    } catch (err) {
      console.error(err)
      setError(errorMessage(err))
    }
  }


  const handleEdit = (blocker) => {
    setEditId(blocker._id)
    setEditText(blocker.blockers)
    setDeleteId(null)
  }

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return toast.error('Blocker text cannot be empty')

    setActionLoading(true)
    try {
      await API.put(`/standups/${id}/blocker`, { blockers: editText })
      toast.success('Blocker updated')
      setEditId(null)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setActionLoading(true)
    try {
      await API.delete(`/standups/${id}`)
      toast.success('Standup deleted')
      setDeleteId(null)
      setBlockers(prev => prev.filter(b => b._id !== id))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const agingCount = blockers.filter(b => ageInDays(b.date) >= 3).length

  return (
    <PageShell>
      <PageHeader
        title="Active blockers"
        subtitle="Everything currently slowing your team down"
        actions={
          canManage && (
            <Badge tone="neutral">
              <IconPencil className="h-3 w-3" />
              {user?.role === 'admin' ? 'Admin' : 'Manager'} — can edit &amp; delete
            </Badge>
          )
        }
      />

      {agingCount > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3"
        >
          <IconHourglass className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong className="font-semibold">{agingCount}</strong>{' '}
            {agingCount === 1 ? 'blocker has' : 'blockers have'} been open for 3+ days
          </p>
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<IconAlert className="h-7 w-7" />} tone="danger" title={error} />
      ) : blockers.length === 0 ? (
        <EmptyState
          icon={<IconCheck className="h-6 w-6" />}
          tone="positive"
          title="No blockers reported"
          description="Everything is running smoothly."
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {blockers.map(b => {
              const age = ageInDays(b.date)
              const aging = age >= 3

              return (
                <motion.div
                  key={b._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, scale: 0.97 }}
                  transition={{ duration: DURATION.base, ease: EASE }}
                >
                  <Card className="p-4 md:p-5">
                    {/* Author row */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600/12 text-sm font-semibold text-brand-700 dark:text-brand-300">
                        {b.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content">
                          {b.user.name}
                        </p>
                        <p className="truncate text-xs text-content-subtle">
                          {b.user.email} · {b.date}
                        </p>
                      </div>
                      <Badge tone={aging ? 'warning' : 'neutral'}>
                        {age === 0 ? 'Today' : `${age}d old`}
                      </Badge>
                    </div>

                    {/* Blocker text / edit form */}
                    <AnimatePresence mode="wait" initial={false}>
                      {editId === b._id ? (
                        <motion.div
                          key="edit"
                          variants={collapseVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="overflow-hidden"
                        >
                          <Textarea
                            rows={3}
                            autoFocus
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            placeholder="Edit blocker text…"
                            className="border-brand-300 dark:border-brand-700"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              full
                              loading={actionLoading}
                              onClick={() => handleSaveEdit(b._id)}
                            >
                              {actionLoading ? 'Saving…' : 'Save changes'}
                            </Button>
                            <Button
                              size="sm"
                              full
                              variant="secondary"
                              onClick={() => setEditId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="view"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="rounded-lg border-l-2 border-red-500/70 bg-red-500/[0.055] py-2.5 pl-3.5 pr-4"
                        >
                          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-red-600 dark:text-red-400">
                            <IconAlert className="h-3.5 w-3.5" />
                            Blocker
                          </p>
                          <p className="text-sm leading-relaxed text-content">{b.blockers}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <p className="mt-3 text-sm text-content-muted">
                      <span className="font-medium text-content">Today&apos;s plan: </span>
                      {b.today}
                    </p>

                    {/* Actions */}
                    {canManage && editId !== b._id && (
                      <div className="mt-3 flex gap-2 border-t border-line pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          full
                          onClick={() => handleEdit(b)}
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>

                        {deleteId === b._id ? (
                          <div className="flex flex-1 gap-2">
                            <Button
                              size="sm"
                              variant="danger"
                              full
                              loading={actionLoading}
                              onClick={() => handleDelete(b._id)}
                            >
                              {actionLoading ? 'Deleting…' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              full
                              onClick={() => setDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="quiet-danger"
                            full
                            onClick={() => {
                              setDeleteId(b._id)
                              setEditId(null)
                            }}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </PageShell>
  )
}
