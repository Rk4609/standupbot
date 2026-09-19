/**
 * The wording of each letter, worked out once at issue.
 *
 * Written around the person's name rather than he or she: the app does not
 * know anybody's pronouns and a letter that guesses wrong is worse than one
 * that repeats a name.
 */
const TITLES = {
  employment: 'Employment certificate',
  salary: 'Salary certificate',
  experience: 'Experience letter',
  relieving: 'Relieving letter'
}

const longDate = (value) => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const rupees = (n, currency = 'INR') =>
  currency === 'INR' ? `₹${Math.round(n).toLocaleString('en-IN')}` : `${currency} ${Math.round(n).toLocaleString('en-IN')}`

/** Who they are here, in one clause: "Asha Verma (Employee ID E-104)". */
const who = (p) => `${p.name}${p.employeeId ? ` (Employee ID ${p.employeeId})` : ''}`
const role = (p) => `${p.position || 'a member of the team'}${p.department ? ` in the ${p.department} department` : ''}`

const atRequest = (purpose) =>
  `This letter is issued at the request of the employee${purpose ? ` for ${purpose.replace(/\.$/, '')}` : ''}.`

/**
 * The title and paragraphs for one letter.
 * `person` is { name, employeeId, position, department, joinedOn },
 * `salary` is { amount, currency, period } when it is a salary certificate.
 */
const letterText = ({ type, person, company, salary, lastDay, purpose }) => {
  const joined = longDate(person.joinedOn)
  const since = joined ? ` since ${joined}` : ''
  const at = company.name

  const body = {
    employment: () => [
      `This is to certify that ${who(person)} is employed with ${at} as ${role(person)}${since}.`,
      atRequest(purpose)
    ],
    salary: () => {
      const yearly = salary.period === 'month' ? salary.amount * 12 : salary.amount
      return [
        `This is to certify that ${who(person)} is employed with ${at} as ${role(person)}${since}.`,
        `${person.name}'s current gross salary is ${rupees(yearly, salary.currency)} a year, which is ${rupees(yearly / 12, salary.currency)} a month, before deductions.`,
        atRequest(purpose)
      ]
    },
    experience: () => [
      `This is to certify that ${who(person)} worked with ${at} as ${role(person)}${joined ? ` from ${joined}` : ''} to ${longDate(lastDay)}.`,
      `During this time ${person.name} was a valued member of the team. We thank ${person.name} for the work done here and wish every success in the years ahead.`
    ],
    relieving: () => [
      `This is to confirm that ${who(person)}, ${role(person)}, has been relieved of all duties at ${at} at the close of business on ${longDate(lastDay)}, following the resignation submitted.`,
      `The full and final settlement is handled separately. We thank ${person.name} for the contribution made and wish the very best for the future.`
    ]
  }[type]()

  return { title: TITLES[type], body }
}

module.exports = { letterText, longDate, TITLES }
