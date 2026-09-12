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
  ).optional().default({})
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
