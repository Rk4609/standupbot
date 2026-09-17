/** "₹66,182" — grouped the way the currency's own country writes it. */
export const money = (amount, currency = 'INR') => {
  const locale = currency === 'INR' ? 'en-IN' : undefined
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, maximumFractionDigits: 0
    }).format(amount || 0)
  } catch {
    return `${currency} ${Math.round(amount || 0).toLocaleString()}`
  }
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const belowHundred = (n) =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`

const belowThousand = (n) => {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ')
}

/**
 * A whole amount in words, in the Indian system a payslip here is read in:
 * "Sixty Six Thousand One Hundred Eighty Two".
 */
export const inWords = (amount) => {
  let n = Math.round(Math.abs(amount || 0))
  if (n === 0) return 'Zero'

  const parts = []
  const crore = Math.floor(n / 10_000_000)
  n %= 10_000_000
  const lakh = Math.floor(n / 100_000)
  n %= 100_000
  const thousand = Math.floor(n / 1000)
  n %= 1000

  if (crore) parts.push(`${inWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (n) parts.push(belowThousand(n))
  return parts.join(' ')
}

export const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  })
