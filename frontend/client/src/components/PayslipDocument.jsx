import { prettyDate } from '../lib/dates'
import { inWords, money, monthLabel } from '../lib/money'

function Detail({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-content-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-content">{value}</dd>
    </div>
  )
}

function Lines({ title, lines, total, totalLabel, currency }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
        <span>{title}</span>
        <span>Amount</span>
      </div>
      <ul className="divide-y divide-line/60">
        {lines.map(line => (
          <li key={line.label} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0 text-content">
              {line.label}
              {line.note && <span className="block text-xs text-content-subtle">{line.note}</span>}
            </span>
            <span className="tabular shrink-0 text-content">{money(line.amount, currency)}</span>
          </li>
        ))}
        {lines.length === 0 && (
          <li className="py-2.5 text-sm text-content-subtle">None</li>
        )}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm font-semibold text-content">
        <span>{totalLabel}</span>
        <span className="tabular">{money(total, currency)}</span>
      </div>
    </div>
  )
}

/**
 * The slip itself, laid out to read on a phone and to print on A4.
 *
 * "Download PDF" is the browser's own save-as-PDF on this page: the app's
 * header and buttons are marked no-print, so what lands in the file is this
 * and nothing else.
 */
export default function PayslipDocument({ slip }) {
  const { employee, currency } = slip

  return (
    <article className="print-plain rounded-card border border-line bg-surface p-5 shadow-card md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-lg font-semibold tracking-tight text-content">StandupBot</p>
          <p className="text-xs text-content-subtle">Payslip</p>
        </div>
        <div className="text-right">
          <p className="text-base font-semibold text-content">{monthLabel(slip.month)}</p>
          {slip.status === 'draft' && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-600">Draft — not published</p>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line py-5 md:grid-cols-4">
        <Detail label="Employee" value={employee.name} />
        <Detail label="Employee ID" value={employee.employeeId} />
        <Detail label="Position" value={employee.position} />
        <Detail label="Department" value={employee.department || employee.team} />
        <Detail label="Joined" value={prettyDate(employee.joinedOn)} />
        <Detail label="Working days" value={slip.workingDays} />
        <Detail label="Paid days" value={slip.paidDays} />
        <Detail label="Loss of pay days" value={slip.lossOfPayDays} />
      </dl>

      <div className="grid gap-6 py-5 md:grid-cols-2 md:gap-10">
        <Lines title="Earnings" lines={slip.earnings} total={slip.gross} totalLabel="Gross earnings" currency={currency} />
        <Lines title="Deductions" lines={slip.deductions} total={slip.totalDeductions} totalLabel="Total deductions" currency={currency} />
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-brand-600 px-5 py-4 text-white dark:bg-brand-400 dark:text-brand-700 print:border print:border-line print:bg-white print:text-black md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-70">Net pay</p>
          <p className="text-xs opacity-80">
            {currency === 'INR' ? `Rupees ${inWords(slip.net)} only` : `${currency} ${slip.net.toLocaleString()}`}
          </p>
        </div>
        <p className="tabular text-3xl font-light tracking-tight">{money(slip.net, currency)}</p>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-content-subtle">
        Income tax is not calculated on this slip. This is a system-generated payslip and needs no signature.
      </p>
    </article>
  )
}
