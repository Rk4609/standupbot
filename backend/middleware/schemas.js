const { z, fields } = require('./validate')

const { isValidTimezone } = require('../utils/time')

const { email, password, name, objectId, isoDate } = fields

/**
 * An IANA zone the platform actually knows. Checked here as well as in the
 * model so a bad value is refused with a readable message rather than a
 * mongoose validation error, and '' is allowed to mean "not set".
 */
const timezone = z
  .string()
  .refine(v => v === '' || isValidTimezone(v), 'is not a known timezone')

/* auth ------------------------------------------------------------- */

const register = z.object({
  name,
  email,
  password,
  // Sent by the browser at sign-up so the first standup already lands on the
  // right day; optional because the API is usable without a browser
  timezone: timezone.optional()
  // `role` is deliberately absent, and this strips rather than rejects: a
  // client still sending it (a cached build, say) keeps working and the value
  // is simply dropped. Accepting it let anyone hand themselves a manager
  // account. Managers and admins are granted by an admin instead.
}).strip()

const login = z.object({ email, password: z.string().min(1, 'is required') }).strict()

const forgotPassword = z.object({ email }).strict()

const resetPassword = {
  params: z.object({ token: z.string().min(20, 'is not a valid reset token') }),
  body: z.object({ password }).strict()
}

/* standups --------------------------------------------------------- */

const MOODS = ['great', 'good', 'okay', 'bad', 'stressed']

const submitStandup = z.object({
  // Which of these are actually required depends on the team's template, so
  // that check lives in the controller. This only bounds the shape.
  yesterday: z.string().trim().max(2000, 'is too long').optional().default(''),
  today: z.string().trim().min(1, 'is required').max(2000, 'is too long'),
  blockers: z.string().trim().max(2000, 'is too long').optional().default(''),
  mood: z.enum(MOODS).optional().default('good'),
  // Answers to the team's own questions, keyed by question
  answers: z.record(
    z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    z.string().trim().max(2000, 'is too long')
  ).optional().default({}),
  // Where the day went, when the team tracks time. Which projects are
  // allowed is checked in the controller against the person's team.
  work: z.array(z.object({
    project: objectId,
    hours: z.coerce.number().min(0.25, 'must be at least 15 minutes').max(24, 'is too many'),
    note: z.string().trim().max(500, 'is too long').optional().default('')
  }).strict()).max(20, 'is too many entries for one day').optional().default([])
}).strict()

const updateBlocker = {
  params: z.object({ id: objectId }),
  body: z.object({ blockers: z.string().trim().max(2000, 'is too long') }).strict()
}

/**
 * Every field optional: an edit sends what changed. At least one must be
 * present, or the request is a no-op dressed up as a change.
 */
const updateStandup = {
  params: z.object({ id: objectId }),
  body: z.object({
    yesterday: z.string().trim().min(1, 'cannot be emptied').max(2000, 'is too long').optional(),
    today: z.string().trim().min(1, 'cannot be emptied').max(2000, 'is too long').optional(),
    blockers: z.string().trim().max(2000, 'is too long').optional(),
    mood: z.enum(MOODS).optional(),
    answers: z.record(
      z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      z.string().trim().max(2000, 'is too long')
    ).optional()
  }).strict().refine(
    b => Object.keys(b).length > 0,
    'Send at least one field to change'
  )
}

const idParam = { params: z.object({ id: objectId }) }

const dateQuery = { query: z.object({ date: isoDate.optional() }).strip() }

/* teams ------------------------------------------------------------ */

const createTeam = z.object({
  name: z.string().trim().min(1, 'is required').max(80, 'is too long'),
  managerId: objectId.optional()
}).strict()

const addMember = {
  params: z.object({ id: objectId }),
  body: z.object({ userId: objectId }).strict()
}

/* users ------------------------------------------------------------ */

const updateProfile = z.object({ name, timezone: timezone.optional() }).strict()

const changePassword = z.object({
  currentPassword: z.string().min(1, 'is required'),
  newPassword: password
}).strict()

const setRole = {
  params: z.object({ id: objectId }),
  body: z.object({ role: z.enum(['admin', 'manager', 'employee']) }).strict()
}

/* employees -------------------------------------------------------- */

const listEmployees = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(100).optional(),
    role: z.enum(['all', 'admin', 'manager', 'employee']).optional(),
    team: z.string().trim().max(80).optional()
  }).strip()
}

/* analytics -------------------------------------------------------- */

const analyticsRange = {
  query: z.object({
    days: z.coerce.number().int().positive().optional()
  }).strip()
}

/* templates -------------------------------------------------------- */

const questionKey = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'must be lowercase letters, digits and underscores')

const saveTemplate = z.object({
  team: objectId.optional(),
  name: z.string().trim().min(1, 'is required').max(80, 'is too long').optional(),
  askMood: z.boolean().optional(),
  trackTime: z.boolean().optional(),
  questions: z.array(z.object({
    key: questionKey,
    label: z.string().trim().min(1, 'is required').max(160, 'is too long'),
    placeholder: z.string().trim().max(160, 'is too long').optional().default(''),
    type: z.enum(['short', 'long']).optional().default('long'),
    required: z.boolean().optional().default(false)
  }).strict()).min(1, 'needs at least one question').max(15, 'is too long to fill in daily')
}).strict()

const templateTeam = {
  query: z.object({ team: objectId.optional() }).strip()
}

/* projects and timesheets ------------------------------------------ */

const createProject = z.object({
  name: z.string().trim().min(1, 'is required').max(120, 'is too long'),
  code: z.string().trim().max(12, 'is too long').optional(),
  client: z.string().trim().max(120, 'is too long').optional(),
  billable: z.boolean().optional(),
  team: objectId.nullable().optional()
}).strict()

const updateProject = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(1, 'is required').max(120, 'is too long').optional(),
    code: z.string().trim().max(12, 'is too long').optional(),
    client: z.string().trim().max(120, 'is too long').optional(),
    billable: z.boolean().optional(),
    active: z.boolean().optional()
  }).strict()
}

const projectMembers = {
  params: z.object({ id: objectId }),
  body: z.object({
    add: z.array(objectId).max(200).optional(),
    remove: z.array(objectId).max(200).optional()
  }).strict().refine(
    b => (b.add?.length || 0) + (b.remove?.length || 0) > 0,
    'Name at least one person to add or remove'
  )
}

const transferMember = {
  params: z.object({ id: objectId }),
  body: z.object({ user: objectId, toProject: objectId }).strict()
}

const weekQuery = {
  query: z.object({ weekStart: isoDate.optional() }).strip()
}

const submitWeek = z.object({ weekStart: isoDate.optional() }).strict()

const reviewWeek = {
  params: z.object({ userId: objectId }),
  body: z.object({
    weekStart: isoDate.optional(),
    action: z.enum(['approve', 'request_changes', 'reopen']),
    note: z.string().trim().max(500, 'is too long').optional()
  }).strict()
}

const personWeek = {
  params: z.object({ userId: objectId }),
  query: z.object({ weekStart: isoDate.optional() }).strip()
}

/* help and support -------------------------------------------------- */

const createTicket = z.object({
  subject: z.string().trim().min(3, 'is too short').max(160, 'is too long'),
  body: z.string().trim().min(5, 'is too short').max(4000, 'is too long'),
  category: z.enum(['bug', 'question', 'access', 'data', 'other']).optional(),
  kind: z.enum(['issue', 'data-change']).optional(),
  request: z.object({
    field: z.string().max(40),
    proposed: z.string().trim().min(1, 'is required').max(200, 'is too long')
  }).strict().optional()
}).strict()

const listTickets = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    status: z.enum(['open', 'answered', 'closed']).optional(),
    category: z.enum(['bug', 'question', 'access', 'data', 'other']).optional()
  }).strip()
}

const replyTicket = {
  params: z.object({ id: objectId }),
  body: z.object({
    body: z.string().trim().min(1, 'is required').max(4000, 'is too long')
  }).strict()
}

const ticketStatus = {
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum(['open', 'answered', 'closed']) }).strict()
}

/* people records ---------------------------------------------------- */

const shortText = (max) => z.string().trim().max(max)
const isoDateish = z.union([z.string().trim().max(40), z.null()])

const listPeople = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(120).optional(),
    role: z.enum(['employee', 'manager', 'admin']).optional(),
    type: z.enum(['intern', 'probation', 'full-time', 'contract']).optional(),
    team: objectId.optional()
  }).strip()
}

const updatePerson = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: shortText(120).min(1, 'is required').optional(),
    phone: shortText(30).optional(),
    dob: isoDateish.optional(),

    address: z.object({
      line1: shortText(200).optional(),
      city: shortText(80).optional(),
      state: shortText(80).optional(),
      pincode: shortText(12).optional(),
      country: shortText(80).optional()
    }).strict().optional(),

    employment: z.object({
      employeeId: shortText(24).optional(),
      position: shortText(80).optional(),
      department: shortText(80).optional(),
      type: z.enum(['intern', 'probation', 'full-time', 'contract']).optional(),
      joinedOn: isoDateish.optional(),
      startsOn: isoDateish.optional(),
      endsOn: isoDateish.optional(),
      experienceYears: z.coerce.number().min(0).max(60).optional()
    }).strict().optional(),

    salary: z.object({
      amount: z.union([z.coerce.number().min(0).max(1e12), z.null()]).optional(),
      currency: shortText(8).optional(),
      period: z.enum(['month', 'year']).optional(),
      reviewedOn: isoDateish.optional()
    }).strict().optional()
  }).strict()
}

/* hiring ------------------------------------------------------------ */

const submitCandidate = z.object({
  name: z.string().trim().min(2, 'is too short').max(120, 'is too long'),
  email: z.string().trim().email('is not an email').max(160),
  phone: z.string().trim().max(30).optional(),
  dob: isoDateish.optional(),

  address: z.object({
    line1: shortText(200).optional(),
    city: shortText(80).optional(),
    state: shortText(80).optional(),
    pincode: shortText(12).optional(),
    country: shortText(80).optional()
  }).strict().optional(),

  position: z.string().trim().min(2, 'is too short').max(80, 'is too long'),
  department: shortText(80).optional(),
  team: z.union([objectId, z.null()]).optional(),
  type: z.enum(['intern', 'probation', 'full-time', 'contract']).optional(),

  joiningOn: isoDateish.optional(),
  startsOn: isoDateish.optional(),
  endsOn: isoDateish.optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),

  expectedSalary: z.object({
    amount: z.union([z.coerce.number().min(0).max(1e12), z.null()]).optional(),
    currency: shortText(8).optional(),
    period: z.enum(['month', 'year']).optional()
  }).strict().optional(),

  cv: z.object({
    url: z.union([z.string().trim().url('is not a link').max(500), z.literal('')]).optional(),
    name: shortText(200).optional()
  }).strict().optional(),

  notes: z.string().trim().max(2000, 'is too long').optional()
}).strict()

const listCandidates = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    status: z.enum(['pending', 'approved', 'rejected']).optional()
  }).strip()
}

const decideCandidate = {
  params: z.object({ id: objectId }),
  body: z.object({
    reason: z.string().trim().max(1000, 'is too long').optional()
  }).strict()
}

/* leave ------------------------------------------------------------- */

const requestLeave = z.object({
  type: z.enum(['casual', 'sick', 'earned', 'unpaid']),
  from: fields.isoDate,
  // Ignored for a half day, which is one day by definition
  to: fields.isoDate.optional(),
  halfDay: z.boolean().optional(),
  reason: z.string().trim().min(3, 'needs a few words').max(500, 'is too long')
}).strict().refine(v => v.halfDay || v.to, { message: 'is required', path: ['to'] })

const listLeave = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    year: z.coerce.number().int().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM').optional()
  }).strip()
}

const decideLeave = {
  params: z.object({ id: objectId }),
  body: z.object({
    note: z.string().trim().max(500, 'is too long').optional()
  }).strict()
}

/* attendance -------------------------------------------------------- */

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM')

const attendanceNote = z.object({
  note: z.string().trim().max(200, 'is too long').optional()
}).strict()

const listAttendance = {
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM').optional(),
    date: fields.isoDate.optional(),
    team: objectId.optional()
  }).strip()
}

const correctAttendance = z.object({
  user: objectId,
  date: fields.isoDate,
  checkIn: clock,
  checkOut: z.union([clock, z.literal(''), z.null()]).optional(),
  reason: z.string().trim().min(3, 'needs a few words').max(300, 'is too long')
}).strict()

/* payslips ---------------------------------------------------------- */

const payrollMonth = {
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM').optional()
  }).strip()
}

const runPayroll = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM')
}).strict()

/* roles and access -------------------------------------------------- */

const moduleList = z.array(z.string().max(40)).max(60)
const base = z.enum(['employee', 'manager', 'admin'])

const createRole = z.object({
  name: z.string().trim().min(2, 'is too short').max(60, 'is too long'),
  description: z.string().trim().max(200, 'is too long').optional(),
  base: base.optional(),
  modules: moduleList.optional()
}).strict()

const updateRole = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(2, 'is too short').max(60, 'is too long').optional(),
    description: z.string().trim().max(200, 'is too long').optional(),
    base: base.optional(),
    modules: moduleList.optional()
  }).strict()
}

const roleId = { params: z.object({ id: objectId }) }

const assignRole = {
  params: z.object({ id: objectId }),
  body: z.object({
    users: z.array(objectId).min(1, 'needs at least one person').max(500)
  }).strict()
}

/* slack ------------------------------------------------------------ */

const slackEvents = z.object({
  standupSubmitted: z.boolean().optional(),
  blockerRaised: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  weeklyRetro: z.boolean().optional()
}).strict()

const saveSlack = z.object({
  team: objectId.optional(),
  // The host is checked again in the service — this only bounds the input
  webhookUrl: z.string().url('must be a URL').max(300, 'is too long'),
  channel: z.string().trim().max(80, 'is too long').optional(),
  events: slackEvents.optional()
}).strict()

const updateSlack = z.object({
  team: objectId.optional(),
  events: slackEvents.optional(),
  active: z.boolean().optional()
}).strict()

const slackTeam = { query: z.object({ team: objectId.optional() }).strip() }
const slackTeamBody = z.object({ team: objectId.optional() }).strict()

/* audit ------------------------------------------------------------ */

const listAudit = {
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    action: z.string().trim().max(60).optional()
  }).strip()
}

/* ai / retro ------------------------------------------------------- */

const analyzeTeam = z.object({ date: isoDate.optional() }).strict()
const generateRetro = z.object({ weekStart: isoDate.optional() }).strict()

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  submitStandup,
  updateBlocker,
  updateStandup,
  saveTemplate,
  templateTeam,
  createProject,
  updateProject,
  projectMembers,
  transferMember,
  listPeople,
  updatePerson,
  submitCandidate,
  listCandidates,
  decideCandidate,
  requestLeave,
  listLeave,
  decideLeave,
  attendanceNote,
  listAttendance,
  correctAttendance,
  payrollMonth,
  runPayroll,
  createRole,
  updateRole,
  roleId,
  assignRole,
  createTicket,
  listTickets,
  replyTicket,
  ticketStatus,
  weekQuery,
  submitWeek,
  reviewWeek,
  personWeek,
  saveSlack,
  updateSlack,
  slackTeam,
  slackTeamBody,
  listAudit,
  idParam,
  dateQuery,
  createTeam,
  addMember,
  updateProfile,
  changePassword,
  setRole,
  listEmployees,
  analyticsRange,
  analyzeTeam,
  generateRetro
}
