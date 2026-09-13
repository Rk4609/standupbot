import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconInbox, IconPlus, IconUser } from '../components/ui/icons'
import TicketThread from '../components/TicketThread'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING, itemVariants, listVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const blank = { subject: '', body: '', category: 'bug' }

const CATEGORY_LABEL = {
  bug: 'Something is broken',
  question: 'A question',
  access: 'I cannot get in somewhere',
  other: 'Something else'
}

const STATUS_LABEL = { open: 'Waiting', answered: 'Answered', closed: 'Closed' }

/**
 * Where anyone says something is wrong, and one person answers.
 *
 * Everybody gets the same page. What changes for an admin is a second tab
 * carrying everyone else's reports, waiting ones first — the queue is the
 * whole point of the module, and burying it under a settings screen would
 * mean nobody reads it.
 */
export default function Support({ user }) {
  const isAdmin = user?.role === 'admin'

  const [tab, setTab] = useState(isAdmin ? 'queue' : 'mine')
  const [mine, setMine] = useState(null)
  const [queue, setQueue] = useState(null)
  const [error, setError] = useState('')
  const [raising, setRaising] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const loadMine = useCallback(
    () =>
      API.get('/support/mine')
        .then(res => setMine(res.data))
        .catch(err => setError(apiErrorMessage(err, 'Could not load your reports'))),
    []
  )

  const loadQueue = useCallback(() => {
    if (!isAdmin) return Promise.resolve()
    const query = new URLSearchParams({ page: String(page) })
    if (status) query.set('status', status)
    return API.get(`/support?${query}`)
      .then(res => setQueue(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not load the queue')))
  }, [isAdmin, page, status])

  useEffect(() => {
    loadMine()
  }, [loadMine])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  const raise = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await API.post('/support', {
        subject: form.subject.trim(),
        body: form.body.trim(),
        category: form.category
      })
      setForm(blank)
      setRaising(false)
      setTab('mine')
      await Promise.all([loadMine(), loadQueue()])
      toast.success('Reported. Somebody will answer here.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send that'))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Help & support" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!mine || (isAdmin && !queue)) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-56" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const waiting = queue?.openCount || 0

  const tabs = [
    isAdmin && { id: 'queue', label: 'Everyone', icon: IconInbox, count: waiting },
    { id: 'mine', label: 'My reports', icon: IconUser, count: 0 }
  ].filter(Boolean)

  return (
    <PageShell>
      <PageHeader
        title="Help & support"
        subtitle={
          isAdmin
            ? 'What people have reported, and what you said back.'
            : 'Report anything that is broken or confusing. You get the answer here.'
        }
        actions={
          <Button onClick={() => setRaising(v => !v)} variant={raising ? 'ghost' : 'solid'}>
            {raising ? 'Cancel' : (
              <>
                <IconPlus className="h-4 w-4" />
                Report an issue
              </>
            )}
          </Button>
        }
      />

      <AnimatePresence initial={false}>
        {raising && (
          <Card
            // On the Card, not on a wrapper: Card carries `variants` and takes
            // its labels from the nearest motion parent, so a wrapper with
            // plain objects would leave it sitting at opacity 0
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="mb-4"
          >
            <CardTitle>What went wrong?</CardTitle>
            <form onSubmit={raise} className="space-y-4">
              <Field label="In one line">
                <Input
                  required
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="The export button does nothing"
                  maxLength={160}
                />
              </Field>

              <Field label="What kind of thing is it?">
                <Select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {(mine.categories || []).map(c => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c] || c}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="What happened"
                hint="What you did, and what you expected instead. A screenshot is not needed — say which page."
              >
                <Textarea
                  required
                  rows={5}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="I click Export CSV on Analytics and no file arrives."
                  maxLength={4000}
                />
              </Field>

              <Button
                type="submit"
                loading={saving}
                disabled={form.subject.trim().length < 3 || form.body.trim().length < 5}
              >
                Send it
              </Button>
            </form>
          </Card>
        )}
      </AnimatePresence>

      {isAdmin && (
        <div
          role="tablist"
          aria-label="Support view"
          className="mb-4 inline-flex rounded-xl bg-surface-sunken p-1"
        >
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t.id ? 'text-content' : 'text-content-muted hover:text-content'
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="support-tab"
                  transition={SPRING}
                  className="absolute inset-0 rounded-lg bg-surface shadow-card"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count > 0 && <Badge tone="warning">{t.count}</Badge>}
              </span>
            </button>
          ))}
        </div>
      )}

      <motion.div variants={listVariants} initial="initial" animate="animate">
        {tab === 'queue' ? (
          <motion.div variants={itemVariants}>
            <Card padded={false}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
                <div>
                  <CardTitle className="mb-0">Everyone&apos;s issues</CardTitle>
                  <p className="mt-1 text-xs text-content-subtle">
                    {waiting > 0
                      ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting on an answer.`
                      : 'Nobody is waiting on an answer.'}
                  </p>
                </div>

                {/* Boxed to a width: the select is w-full by default, and a
                    filter stretched across the card reads as the main control */}
                <div className="w-full sm:w-44">
                  <Select
                    value={status}
                    onChange={e => {
                      setStatus(e.target.value)
                      setPage(1)
                    }}
                    aria-label="Filter by status"
                    className="py-2 text-sm"
                  >
                    <option value="">All of them</option>
                    {(queue.statuses || []).map(s => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s] || s}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {queue.tickets.length === 0 ? (
                <div className="px-4 pb-6 md:px-6">
                  <EmptyState
                    icon={<IconInbox className="h-6 w-6" />}
                    title="Nothing reported"
                    description="When somebody hits a problem, it lands here."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {queue.tickets.map(t => (
                    <TicketThread key={t._id} ticket={t} isAdmin showWho />
                  ))}
                </ul>
              )}

              {queue.totalPages > 1 && (
                <div className="border-t border-line px-4 py-3 md:px-6">
                  <Pagination
                    page={queue.page}
                    totalPages={queue.totalPages}
                    total={queue.total}
                    limit={queue.limit}
                    onPage={setPage}
                  />
                </div>
              )}
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            {mine.tickets.length === 0 ? (
              <EmptyState
                icon={<IconInbox className="h-6 w-6" />}
                title="You have not reported anything"
                description="If something is broken or you cannot work out how a page works, say so here."
                action={
                  <Button onClick={() => setRaising(true)}>
                    <IconPlus className="h-4 w-4" />
                    Report an issue
                  </Button>
                }
              />
            ) : (
              <Card padded={false}>
                <div className="px-4 py-4 md:px-6">
                  <CardTitle className="mb-0">My reports</CardTitle>
                  <p className="mt-1 text-xs text-content-subtle">
                    Open one to read the answer, or to add something you forgot.
                  </p>
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {mine.tickets.map(t => (
                    <TicketThread
                      key={t._id}
                      ticket={t}
                      isAdmin={false}
                      defaultOpen={mine.tickets.length === 1}
                    />
                  ))}
                </ul>
              </Card>
            )}
          </motion.div>
        )}
      </motion.div>
    </PageShell>
  )
}
