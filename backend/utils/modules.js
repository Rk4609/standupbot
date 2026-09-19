/**
 * The things a person can be given, or refused, access to.
 *
 * One list, shared by the permission middleware, the roles screen and the
 * sidebar. A module is a piece of the product somebody either uses or does
 * not — not a route and not a button, because permissions that are finer
 * than the way people talk about the app end up being set wrong.
 *
 * `minBase` is the authority the server itself demands for that area. A role
 * based on `employee` cannot be handed the audit trail by ticking a box: the
 * route would refuse it anyway, and a switch that does nothing is worse than
 * no switch.
 */
const MODULES = [
  // What everybody does with their own day
  { key: 'dashboard', label: 'Dashboard', group: 'Personal', minBase: 'employee', always: true },
  { key: 'standup', label: 'Submit a standup', group: 'Personal', minBase: 'employee' },
  { key: 'history', label: 'Own history', group: 'Personal', minBase: 'employee' },
  { key: 'timesheet', label: 'Own timesheet', group: 'Personal', minBase: 'employee' },
  { key: 'leave', label: 'Leave — ask for time off', group: 'Personal', minBase: 'employee', rollOut: true },
  { key: 'attendance', label: 'Attendance — check in and out', group: 'Personal', minBase: 'employee', rollOut: true },
  { key: 'payslips', label: 'Payslips — own salary slips', group: 'Personal', minBase: 'employee', rollOut: true },
  { key: 'kudos', label: 'Kudos — thank teammates', group: 'Personal', minBase: 'employee', rollOut: true },
  { key: 'expenses', label: 'Expenses — claim money back', group: 'Personal', minBase: 'employee', rollOut: true },
  { key: 'support', label: 'Help & support', group: 'Personal', minBase: 'employee', always: true },

  // What a lead does with other people's days
  { key: 'team', label: 'Team overview', group: 'Team', minBase: 'manager' },
  { key: 'employees', label: 'Employees', group: 'Team', minBase: 'manager' },
  { key: 'blockers', label: 'Blockers board', group: 'Team', minBase: 'manager' },
  { key: 'timesheets', label: 'Timesheet approvals', group: 'Team', minBase: 'manager' },
  { key: 'analytics', label: 'Analytics & exports', group: 'Team', minBase: 'manager' },
  { key: 'retro', label: 'Weekly retro', group: 'Team', minBase: 'manager' },
  { key: 'leaves', label: 'Leave approvals', group: 'Team', minBase: 'manager', rollOut: true },
  { key: 'team-attendance', label: 'Team attendance', group: 'Team', minBase: 'manager', rollOut: true },
  { key: 'expense-approvals', label: 'Expense approvals', group: 'Team', minBase: 'manager', rollOut: true },
  { key: 'brief', label: 'Daily AI brief', group: 'Team', minBase: 'manager', rollOut: true },
  { key: 'reports', label: 'Weekly project report', group: 'Team', minBase: 'manager', rollOut: true },

  // What gets set up once
  { key: 'projects', label: 'Projects & assignments', group: 'Workspace', minBase: 'manager' },
  { key: 'templates', label: 'Standup template', group: 'Workspace', minBase: 'manager' },
  { key: 'integrations', label: 'Integrations', group: 'Workspace', minBase: 'manager' },
  { key: 'activity', label: 'Activity log', group: 'Workspace', minBase: 'manager' },
  { key: 'records', label: 'People records', group: 'Workspace', minBase: 'manager' },
  { key: 'hiring', label: 'Hiring — put people forward', group: 'Workspace', minBase: 'manager' },
  { key: 'announce', label: 'Announcements — post notices', group: 'Workspace', minBase: 'manager', rollOut: true },
  { key: 'onboarding', label: 'Onboarding — checklists for new joiners', group: 'Workspace', minBase: 'manager', rollOut: true },
  { key: 'approvals', label: 'Approvals — decide on hires', group: 'Workspace', minBase: 'admin' },
  { key: 'pay', label: 'Pay details', group: 'Workspace', minBase: 'admin' },
  { key: 'people', label: 'People & teams', group: 'Workspace', minBase: 'admin' },
  { key: 'roles', label: 'Roles & access', group: 'Workspace', minBase: 'admin' },
  { key: 'settings', label: 'Company settings — hours, leave, pay, holidays', group: 'Workspace', minBase: 'admin', rollOut: true }
]

const MODULE_KEYS = MODULES.map(m => m.key)

/**
 * Modules added after roles were already being saved.
 *
 * A role stored before one of these existed has never been asked about it,
 * so it is handed its base's default once (see ensureBuiltIns). Everything
 * else in the catalogue is what every stored role has already been offered,
 * which is why removing one of those by hand stays removed.
 */
const ROLLED_OUT = MODULES.filter(m => m.rollOut).map(m => m.key)

/** Nobody can be locked out of these — they are how you get anywhere at all. */
const ALWAYS = MODULES.filter(m => m.always).map(m => m.key)

const BASES = ['employee', 'manager', 'admin']

/** Higher means more authority. Used to keep a role inside its own base. */
const rank = (base) => Math.max(0, BASES.indexOf(base))

/** The modules a role with this base is allowed to hold at all. */
const allowedFor = (base) =>
  MODULES.filter(m => rank(base) >= rank(m.minBase)).map(m => m.key)

/** What each built-in role starts with, and what a new role is offered. */
const DEFAULTS = {
  employee: ['dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'kudos', 'expenses', 'support'],
  manager: [
    'dashboard', 'standup', 'history', 'timesheet', 'leave', 'attendance', 'payslips', 'kudos', 'expenses', 'support',
    'team', 'employees', 'blockers', 'timesheets', 'analytics', 'retro', 'leaves', 'team-attendance', 'brief', 'reports', 'expense-approvals',
    'projects', 'templates', 'integrations', 'activity', 'records', 'hiring', 'onboarding', 'announce'
  ],
  admin: MODULE_KEYS
}

/** Keep only real module keys this base may hold, plus the unremovable ones. */
const sanitise = (modules, base) => {
  const allowed = new Set(allowedFor(base))
  const kept = (modules || []).filter(key => allowed.has(key))
  return [...new Set([...kept, ...ALWAYS])]
}

module.exports = { MODULES, MODULE_KEYS, ROLLED_OUT, ALWAYS, BASES, DEFAULTS, allowedFor, sanitise, rank }
