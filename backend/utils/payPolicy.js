const { addDays, isWeekend } = require('./time')

/**
 * How a monthly salary is split and what comes off it.
 *
 * A common Indian structure, kept deliberately simple: half of gross is
 * basic, a fifth is house rent allowance, the rest is a special allowance.
 * Provident fund is 12% of basic up to the statutory wage ceiling, and a flat
 * professional tax applies above a threshold. Income tax is not worked out
 * here — it depends on declarations this app does not hold — and the slip
 * says so rather than printing a guess.
 */
const SPLIT = { basic: 0.5, hra: 0.2 }
const PF = { rate: 0.12, wageCeiling: 15000 }
const PROFESSIONAL_TAX = { amount: 200, from: 15000 }

const rupees = (n) => Math.round(n)

const monthBounds = (month) => {
  const first = `${month}-01`
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1)
  return { first, last }
}

/** Monday to Friday in the month. */
const workingDaysIn = (month) => {
  const { first, last } = monthBounds(month)
  let count = 0
  for (let day = first; day <= last; day = addDays(day, 1)) {
    if (!isWeekend(day)) count += 1
  }
  return count
}

/** A salary record as a monthly figure. */
const monthlyOf = (salary) => {
  if (!salary?.amount) return 0
  return rupees(salary.period === 'month' ? salary.amount : salary.amount / 12)
}

/**
 * The slip's numbers for one person and month.
 *
 * `unpaidLeaveDays`, `absentDays` and `notJoinedDays` (working days before a
 * mid-month joining) are all working days not paid for. Together they can
 * never take more than the month's working days.
 */
const computeSlip = ({ salary, month, unpaidLeaveDays = 0, absentDays = 0, notJoinedDays = 0 }) => {
  const gross = monthlyOf(salary)
  const currency = salary?.currency || 'INR'
  const workingDays = workingDaysIn(month)
  const lossOfPayDays = Math.min(workingDays, unpaidLeaveDays + absentDays + notJoinedDays)

  const basic = rupees(gross * SPLIT.basic)
  const hra = rupees(gross * SPLIT.hra)
  const special = gross - basic - hra

  const earnings = [
    { label: 'Basic', amount: basic },
    { label: 'House rent allowance', amount: hra },
    { label: 'Special allowance', amount: special }
  ]

  const deductions = []
  // Statutory deductions are Indian rules; a salary paid in another currency
  // gets none rather than the wrong ones
  if (currency === 'INR') {
    const pf = rupees(Math.min(basic, PF.wageCeiling) * PF.rate)
    if (pf > 0) deductions.push({ label: 'Provident fund', amount: pf, note: '12% of basic' })
    if (gross >= PROFESSIONAL_TAX.from) {
      deductions.push({ label: 'Professional tax', amount: PROFESSIONAL_TAX.amount })
    }
  }

  if (lossOfPayDays > 0 && workingDays > 0) {
    const parts = [
      unpaidLeaveDays ? `${unpaidLeaveDays} unpaid leave` : '',
      absentDays ? `${absentDays} absent` : '',
      notJoinedDays ? `${notJoinedDays} before joining` : ''
    ].filter(Boolean).join(' + ')
    deductions.push({
      label: 'Loss of pay',
      amount: rupees((gross / workingDays) * lossOfPayDays),
      note: `${lossOfPayDays} ${lossOfPayDays === 1 ? 'day' : 'days'} · ${parts}`
    })
  }

  // Never a negative slip: deductions stop at what was earned
  const totalDeductions = Math.min(gross, deductions.reduce((n, d) => n + d.amount, 0))

  return {
    currency,
    workingDays,
    paidDays: workingDays - lossOfPayDays,
    lossOfPayDays,
    unpaidLeaveDays,
    absentDays,
    notJoinedDays,
    earnings,
    deductions,
    gross,
    totalDeductions,
    net: gross - totalDeductions
  }
}

module.exports = { SPLIT, PF, PROFESSIONAL_TAX, monthBounds, workingDaysIn, monthlyOf, computeSlip }
