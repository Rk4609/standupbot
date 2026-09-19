export const LETTER_TYPE = {
  employment: { label: 'Employment certificate', hint: 'That you work here, since when, and as what — for a bank, a visa or a rental' },
  salary: { label: 'Salary certificate', hint: 'The above, with your current salary — for a loan or a credit card' },
  experience: { label: 'Experience letter', hint: 'For when you move on: the time you worked here' },
  relieving: { label: 'Relieving letter', hint: 'That you have been relieved of your duties, after your last day' }
}

export const NEEDS_LAST_DAY = ['experience', 'relieving']

export const LETTER_STATUS = {
  requested: { label: 'With HR', tone: 'warning' },
  issued: { label: 'Issued', tone: 'positive' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' }
}

/** "17 September 2026" from "2026-09-17". */
export const letterDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
