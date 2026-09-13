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
  { key: 'support', label: 'Help & support', group: 'Personal', minBase: 'employee', always: true },

  // What a lead does with other people's days
  { key: 'team', label: 'Team overview', group: 'Team', minBase: 'manager' },
  { key: 'employees', label: 'Employees', group: 'Team', minBase: 'manager' },
  { key: 'blockers', label: 'Blockers board', group: 'Team', minBase: 'manager' },
  { key: 'timesheets', label: 'Timesheet approvals', group: 'Team', minBase: 'manager' },
  { key: 'analytics', label: 'Analytics & exports', group: 'Team', minBase: 'manager' },
  { key: 'retro', label: 'Weekly retro', group: 'Team', minBase: 'manager' },

  // What gets set up once
  { key: 'projects', label: 'Projects & assignments', group: 'Workspace', minBase: 'manager' },
  { key: 'templates', label: 'Standup template', group: 'Workspace', minBase: 'manager' },
  { key: 'integrations', label: 'Integrations', group: 'Workspace', minBase: 'manager' },
  { key: 'activity', label: 'Activity log', group: 'Workspace', minBase: 'manager' },
  { key: 'records', label: 'People records', group: 'Workspace', minBase: 'manager' },
  { key: 'hiring', label: 'Hiring — put people forward', group: 'Workspace', minBase: 'manager' },
  { key: 'approvals', label: 'Approvals — decide on hires', group: 'Workspace', minBase: 'admin' },
  { key: 'pay', label: 'Pay details', group: 'Workspace', minBase: 'admin' },
  { key: 'people', label: 'People & teams', group: 'Workspace', minBase: 'admin' },
  { key: 'roles', label: 'Roles & access', group: 'Workspace', minBase: 'admin' }
]

const MODULE_KEYS = MODULES.map(m => m.key)

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
  employee: ['dashboard', 'standup', 'history', 'timesheet', 'support'],
  manager: [
    'dashboard', 'standup', 'history', 'timesheet', 'support',
    'team', 'employees', 'blockers', 'timesheets', 'analytics', 'retro',
    'projects', 'templates', 'integrations', 'activity', 'records', 'hiring'
  ],
  admin: MODULE_KEYS
}

/** Keep only real module keys this base may hold, plus the unremovable ones. */
const sanitise = (modules, base) => {
  const allowed = new Set(allowedFor(base))
  const kept = (modules || []).filter(key => allowed.has(key))
  return [...new Set([...kept, ...ALWAYS])]
}

module.exports = { MODULES, MODULE_KEYS, ALWAYS, BASES, DEFAULTS, allowedFor, sanitise, rank }
