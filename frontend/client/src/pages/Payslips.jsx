import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert, IconInbox, IconPrinter } from '../components/ui/icons'
import PayslipDocument from '../components/PayslipDocument'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { money, monthLabel } from '../lib/money'
import { prettyDate } from '../lib/dates'

/** One slip, ready to read or save as PDF. */
function PayslipView({ id }) {
  const [slip, setSlip] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    API.get(`/payslips/${id}`)
      .then(res => current && setSlip(res.data.payslip))
      .catch(err => current && setError(apiErrorMessage(err, 'Could not load that payslip')))
    return () => { current = false }
  }, [id])

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <div className="no-print">
          <PageHeader
            title={slip ? monthLabel(slip.month) : 'Payslip'}
            subtitle={slip?.employee?.name}
            actions={
              <div className="flex gap-2">
                <Button variant="ghost" to="/payslips">All payslips</Button>
                {slip && (
                  <Button onClick={() => window.print()}>
                    <IconPrinter className="h-4 w-4" />
                    Download PDF
                  </Button>
                )}
              </div>
            }
          />
        </div>

        {error ? (
          <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
        ) : slip ? (
          <PayslipDocument slip={slip} />
        ) : (
          <Skeleton className="h-[36rem] rounded-card" />
        )}
      </div>
    </PageShell>
  )
}

/**
 * My payslips, newest first; tap one to read or save it.
 */
export default function Payslips() {
  const { id } = useParams()
  const live = useLiveRefresh()
  const [slips, setSlips] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) return
    API.get('/payslips/mine')
      .then(res => {
        setSlips(res.data.payslips)
        setError('')
      })
      .catch(err => setError(apiErrorMessage(err, 'Could not load your payslips')))
  }, [id, live])

  if (id) return <PayslipView id={id} />

  return (
    <PageShell>
      <PageHeader title="Payslips" subtitle="Each month's slip appears here once payroll publishes it." />

      {error && !slips ? (
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      ) : !slips ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-36 rounded-card" />)}
        </div>
      ) : slips.length === 0 ? (
        <EmptyState
          icon={<IconInbox className="h-6 w-6" />}
          title="No payslips yet"
          description="When payroll publishes a month, its slip lands here and you get a notification."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slips.map((slip, i) => (
            <Link key={slip._id} to={`/payslips/${slip._id}`} className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {/* Not a Card: the latest slip has its own surface, and Card's
                  would sit under it with class order deciding which shows */}
              <div
                className={
                  i === 0
                    ? 'rounded-card bg-brand-600 p-5 text-white shadow-card transition-shadow hover:shadow-lift dark:bg-surface-raised dark:text-content md:p-6'
                    : 'rounded-card border border-line/70 bg-surface/85 p-5 text-content shadow-card transition-shadow hover:shadow-lift md:p-6'
                }
              >
                <p className={i === 0 ? 'text-xs uppercase tracking-wide text-white/60 dark:text-content-subtle' : 'eyebrow'}>
                  {i === 0 ? 'Latest' : 'Payslip'}
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{monthLabel(slip.month)}</p>
                <p className="tabular mt-4 text-3xl font-light tracking-tight">{money(slip.net, slip.currency)}</p>
                <p className={i === 0 ? 'mt-1 text-xs text-white/70 dark:text-content-subtle' : 'mt-1 text-xs text-content-subtle'}>
                  Net pay · gross {money(slip.gross, slip.currency)}
                  {slip.lossOfPayDays ? ` · ${slip.lossOfPayDays} LOP days` : ''}
                </p>
                {slip.publishedAt && (
                  <p className={i === 0 ? 'mt-3 text-[11px] text-white/50 dark:text-content-subtle' : 'mt-3 text-[11px] text-content-subtle'}>
                    Published {prettyDate(slip.publishedAt)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  )
}
