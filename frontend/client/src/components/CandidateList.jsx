import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Modal from './ui/Modal'
import { Field, Textarea } from './ui/Field'
import { IconCheck, IconClose, IconCopy, IconTrash } from './ui/icons'
import { cn } from '../lib/cn'
import { collapseVariants } from '../lib/motion'
import { prettyDate } from '../lib/dates'
import { apiErrorMessage } from '../lib/apiError'

const STATUS_TONE = { pending: 'warning', approved: 'positive', rejected: 'danger' }
const STATUS_LABEL = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }

const TYPE_LABEL = {
  intern: 'Intern',
  probation: 'On probation',
  'full-time': 'Full time',
  contract: 'Contract'
}

/** One field of the submission. Empty ones are left out. */
function Line({ label, children }) {
  if (!children) return null
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm text-content">{children}</dd>
    </div>
  )
}

/**
 * The submissions, and — for whoever decides — the two buttons.
 *
 * A rejection asks for a reason before it will go through: the manager who
 * put this person forward has to do something next, and "no" on its own
 * starts that conversation from nothing.
 */
export default function CandidateList({ candidates, canDecide, maySeePay, onChanged }) {
  const [openId, setOpenId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)

  const approve = async (candidate) => {
    setBusy(true)
    try {
      const { data } = await API.post(`/hiring/${candidate._id}/approve`)
      toast.success(data.message)
      setCreated({ name: candidate.name, ...data.account })
      onChanged?.()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not approve that'))
    } finally {
      setBusy(false)
    }
  }

  const reject = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await API.post(`/hiring/${rejecting._id}/reject`, { reason: reason.trim() })
      toast.success(data.message)
      setRejecting(null)
      setReason('')
      onChanged?.()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not reject that'))
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (candidate) => {
    setBusy(true)
    try {
      const { data } = await API.delete(`/hiring/${candidate._id}`)
      toast.success(data.message)
      onChanged?.()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not withdraw that'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ul className="divide-y divide-line border-t border-line">
        {candidates.map(c => {
          const open = openId === c._id
          const address = [c.address?.line1, c.address?.city, c.address?.state, c.address?.pincode]
            .filter(Boolean).join(', ')

          return (
            <li key={c._id} className={cn(c.status !== 'pending' && 'opacity-80')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c._id)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-content">{c.name}</span>
                    <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <Badge tone="neutral">{TYPE_LABEL[c.type] || c.type}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-content-subtle">
                    {c.position}
                    {c.team?.name ? ` · ${c.team.name}` : ''}
                    {c.joiningOn ? ` · joins ${prettyDate(c.joiningOn)}` : ''}
                    {` · put forward by ${c.submittedByName}`}
                  </span>
                </button>

                {c.status === 'pending' && canDecide && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button onClick={() => approve(c)} disabled={busy}>
                      <IconCheck className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejecting(c)}
                      disabled={busy}
                    >
                      <IconClose className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {c.status === 'pending' && !canDecide && (
                  <button
                    type="button"
                    onClick={() => withdraw(c)}
                    disabled={busy}
                    aria-label={`Withdraw ${c.name}`}
                    className="shrink-0 rounded-md p-1.5 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line bg-surface-sunken/40 px-4 py-4 md:px-6">
                      {c.status !== 'pending' && (
                        <p
                          className={cn(
                            'mb-4 rounded-xl border px-3.5 py-3 text-sm',
                            c.status === 'approved'
                              ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-content'
                              : 'border-red-500/30 bg-red-500/[0.06] text-content'
                          )}
                        >
                          <span className="font-medium">
                            {STATUS_LABEL[c.status]} by {c.decidedByName}
                          </span>
                          {c.decidedAt ? ` · ${prettyDate(c.decidedAt)}` : ''}
                          {c.reason ? ` — ${c.reason}` : ''}
                        </p>
                      )}

                      <div className="grid gap-6 md:grid-cols-3">
                        <dl className="space-y-3">
                          <Line label="Email">
                            <span className="break-all">{c.email}</span>
                          </Line>
                          <Line label="Phone">{c.phone}</Line>
                          <Line label="Date of birth">{prettyDate(c.dob)}</Line>
                          <Line label="Address">{address}</Line>
                        </dl>

                        <dl className="space-y-3">
                          <Line label="Position">{c.position}</Line>
                          <Line label="Department">{c.department}</Line>
                          <Line label="Team">{c.team?.name}</Line>
                          <Line label="Joining on">{prettyDate(c.joiningOn)}</Line>
                          <Line
                            label={c.type === 'intern' ? 'Internship ends' : 'Probation ends'}
                          >
                            {prettyDate(c.endsOn)}
                          </Line>
                          <Line label="Experience so far">
                            {c.experienceYears ? `${c.experienceYears} years` : null}
                          </Line>
                        </dl>

                        <dl className="space-y-3">
                          {maySeePay && (
                            <Line label="Agreed pay">
                              {c.expectedSalary?.amount
                                ? `${c.expectedSalary.currency || ''} ${Number(c.expectedSalary.amount).toLocaleString()} / ${c.expectedSalary.period === 'month' ? 'month' : 'year'}`
                                : null}
                            </Line>
                          )}
                          <Line label="CV">
                            {c.cv?.url ? (
                              <a
                                href={c.cv.url}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                              >
                                {c.cv.name || 'Open the CV'}
                              </a>
                            ) : null}
                          </Line>
                          <Line label="Notes">
                            {c.notes ? (
                              <span className="whitespace-pre-line">{c.notes}</span>
                            ) : null}
                          </Line>
                          <Line label="Account">
                            {c.createdUser ? c.createdUser.email : null}
                          </Line>
                        </dl>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {rejecting && (
          <Modal
            title={`Reject ${rejecting.name}?`}
            subtitle="The manager who put them forward sees this."
            onClose={() => {
              setRejecting(null)
              setReason('')
            }}
          >
            <form onSubmit={reject} className="space-y-4">
              <Field label="Why" hint="One line is enough, but it has to say something.">
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="No headcount until April."
                  maxLength={1000}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={busy} disabled={reason.trim().length < 3}>
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRejecting(null)
                    setReason('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {created && (
          <Modal
            title={`${created.name} is in`}
            subtitle="Give them this once. They can change it from their profile."
            onClose={() => setCreated(null)}
          >
            <div className="space-y-4">
              <dl className="divide-y divide-line rounded-xl border border-line">
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-xs text-content-subtle">Sign in with</dt>
                  <dd className="truncate text-sm text-content">{created.email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-xs text-content-subtle">Temporary password</dt>
                  <dd className="tabular text-sm font-medium text-content">
                    {created.tempPassword}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${created.email} / ${created.tempPassword}`
                    )
                    toast.success('Copied')
                  }}
                >
                  <IconCopy className="h-4 w-4" />
                  Copy both
                </Button>
                <Button variant="ghost" onClick={() => setCreated(null)}>
                  Done
                </Button>
              </div>

              <p className="text-xs text-content-subtle">
                This is the only time it is shown. If it is lost, they can use
                “forgot password” on the sign-in screen.
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}
