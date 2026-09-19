/**
 * Matching for the command palette.
 *
 * People type fragments ("lev app", "pay") and the words they use, not the
 * page's name ("chhutti", "salary"), so each page carries a few other words
 * and a match can be spread across the label.
 */

/** Other words people reach for, by path. */
export const KEYWORDS = {
  '/dashboard': ['home', 'start'],
  '/standup/new': ['write', 'update', 'today', 'daily'],
  '/history': ['past', 'previous standups'],
  '/kudos': ['thanks', 'thank you', 'appreciate', 'shabash', 'shabashi'],
  '/support': ['help', 'ticket', 'issue', 'problem', 'complaint'],
  '/attendance': ['check in', 'check out', 'punch', 'hazri', 'present'],
  '/timesheet': ['hours', 'time'],
  '/leave': ['holiday', 'time off', 'vacation', 'sick', 'chhutti'],
  '/payslips': ['salary', 'pay', 'tankha', 'slip'],
  '/expenses': ['reimbursement', 'claim', 'bill', 'receipt', 'kharcha'],
  '/documents': ['letter', 'certificate', 'experience letter', 'salary certificate', 'relieving', 'noc', 'proof'],
  '/reviews': ['performance', 'appraisal', 'self review', 'one on one', '1:1', 'feedback'],
  '/brief': ['ai', 'summary', 'morning'],
  '/team': ['overview', 'health'],
  '/employees': ['people', 'roster', 'staff'],
  '/blockers': ['stuck', 'blocked'],
  '/timesheets': ['approve hours'],
  '/team-attendance': ['who is in', 'late', 'absent'],
  '/leaves': ['approve leave', 'chhutti approval'],
  '/expense-approvals': ['approve claim', 'reimbursement', 'bills'],
  '/team-reviews': ['performance', 'appraisal', 'review round', 'one on one', '1:1', 'feedback'],
  '/analytics': ['charts', 'stats', 'export'],
  '/reports': ['status report', 'client', 'pdf', 'weekly'],
  '/retro': ['retrospective'],
  '/profile': ['account', 'password', 'timezone', 'me'],
  '/workspace/projects': ['clients', 'assign'],
  '/workspace/records': ['people records', 'employee details'],
  '/workspace/hiring': ['candidate', 'new joiner', 'recruit'],
  '/workspace/onboarding': ['new joiner', 'checklist'],
  '/workspace/announcements': ['notice', 'broadcast', 'news', 'suchna'],
  '/workspace/approvals': ['approve hire'],
  '/workspace/payroll': ['salary', 'run payroll', 'payslips'],
  '/workspace/admin': ['users', 'admin'],
  '/workspace/roles': ['permissions', 'access'],
  '/workspace/letters': ['issue letter', 'certificate', 'experience letter', 'relieving letter'],
  '/workspace/settings': ['holiday', 'holidays', 'office hours', 'leave quota', 'chhutti list', 'settings', 'company name', 'address', 'signatory']
}

const normalise = (text) => String(text || '').toLowerCase().trim()

/**
 * How well `query` matches `text`: higher is better, 0 is no match.
 *
 * A whole-word start beats a start inside a word, which beats the letters
 * merely appearing in order ("lvap" still finds "Leave approvals").
 */
export const score = (query, text) => {
  const q = normalise(query)
  const t = normalise(text)
  if (!q) return 1
  if (!t) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.split(/[\s/—-]+/).some(word => word.startsWith(q))) return 60
  if (t.includes(q)) return 40

  // Every word of the query starting some word of the text: "lea app"
  const words = t.split(/[\s/—-]+/)
  const parts = q.split(/\s+/)
  if (parts.length > 1 && parts.every(p => words.some(w => w.startsWith(p)))) return 50

  // Letters in order, but close together: "lvap" finds "Leave approvals",
  // while "sal" spread across "Standup template" is not a match anybody meant
  const letters = q.replace(/\s+/g, '')
  let at = -1
  let first = -1
  for (const ch of letters) {
    at = t.indexOf(ch, at + 1)
    if (at === -1) return 0
    if (first === -1) first = at
  }
  return at - first < letters.length * 3 ? 10 : 0
}

/** The best of an item's label and its other words. */
export const scoreItem = (query, item) =>
  Math.max(
    score(query, item.label),
    ...(item.keywords || []).map(k => score(query, k) * 0.9),
    // "team attendance" finds the team's Attendance page, but the group name
    // alone does not drag in every page under it
    item.group && score(query, `${item.group} ${item.label}`) >= 50
      ? score(query, `${item.group} ${item.label}`) * 0.8
      : 0
  )

/** Items matching `query`, best first, keeping the original order on a tie. */
export const rank = (items, query, limit = 8) =>
  items
    .map((item, index) => ({ item, index, value: scoreItem(query, item) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, limit)
    .map(r => r.item)
