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
      toast.success('Blocker updated ✅')
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
      toast.success('Standup deleted 🗑️')
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
        title="🚨 Active blockers"
        subtitle="Everything currently slowing your team down"
        actions={
          canManage && (
            <Badge tone="danger">
              {user?.role === 'admin' ? 'Admin' : 'Manager'} — edit &amp; delete enabled
            </Badge>
          )
        }
      />

      {agingCount > 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/50"
        >
          <span aria-hidden="true">⏳</span>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>{agingCount}</strong>{' '}
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
        <EmptyState icon="⚠️" tone="danger" title={error} />
      ) : blockers.length === 0 ? (
        <EmptyState
          icon="🎉"
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
                  <Card className="border-red-100 p-4 dark:border-red-950 md:p-5">
                    {/* Author row */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
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
                      <Badge tone={aging ? 'warning' : 'danger'}>
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
                              {actionLoading ? 'Saving…' : '✅ Save changes'}
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
                          className="rounded-xl border-l-[3px] border-l-red-500 bg-red-50 px-4 py-3 dark:bg-red-950/50"
                        >
                          <p className="text-sm text-red-700 dark:text-red-300">{b.blockers}</p>
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
                          variant="subtle"
                          full
                          onClick={() => handleEdit(b)}
                        >
                          ✏️ Edit blocker
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
                            variant="danger-subtle"
                            full
                            onClick={() => {
                              setDeleteId(b._id)
                              setEditId(null)
                            }}
                          >
                            🗑️ Delete
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
