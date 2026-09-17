const { addDays } = require('./time')

/**
 * What has to happen when somebody joins, and whose job each part is.
 *
 *   hr        the admins — paperwork, pay, accounts
 *   manager   the person's lead — equipment, people, first goals
 *   employee  the joiner — their own profile and first steps
 *
 * `day` is counted from the joining date: 0 is the first day, negative is
 * before it. Due dates are worked out once, when the checklist is made, so
 * a joining date moved later does not quietly make every task overdue.
 */
const OWNERS = ['hr', 'manager', 'employee']

const PLAN = [
  { title: 'Signed offer letter and NDA received', owner: 'hr', day: -1 },
  { title: 'ID and address proof collected', owner: 'hr', day: 0 },
  { title: 'Company email and app account set up', owner: 'hr', day: 0 },
  { title: 'Salary and bank details on record', owner: 'hr', day: 3 },

  { title: 'Laptop and access ready', owner: 'manager', day: 0 },
  { title: 'Introduced to the team', owner: 'manager', day: 1 },
  { title: 'Buddy assigned', owner: 'manager', day: 1 },
  { title: 'First-week goals agreed', owner: 'manager', day: 2 },
  { title: '30-day check-in held', owner: 'manager', day: 30 },

  { title: 'Profile completed and timezone set', owner: 'employee', day: 1 },
  { title: 'First standup submitted', owner: 'employee', day: 1 },
  { title: 'Company policies read', owner: 'employee', day: 5 }
]

/** The checklist for somebody joining on `startsOn` ('YYYY-MM-DD'). */
const tasksFor = (startsOn) =>
  PLAN.map(task => ({
    title: task.title,
    owner: task.owner,
    dueOn: addDays(startsOn, task.day),
    done: false
  }))

module.exports = { OWNERS, PLAN, tasksFor }
