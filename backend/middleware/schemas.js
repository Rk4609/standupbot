const { z, fields } = require('./validate')

const { email, password, name, objectId, isoDate } = fields

/* auth ------------------------------------------------------------- */

const register = z.object({
  name,
  email,
  password
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
  yesterday: z.string().trim().min(1, 'is required').max(2000, 'is too long'),
  today: z.string().trim().min(1, 'is required').max(2000, 'is too long'),
  blockers: z.string().trim().max(2000, 'is too long').optional().default(''),
  mood: z.enum(MOODS).optional().default('good')
}).strict()

const updateBlocker = {
  params: z.object({ id: objectId }),
  body: z.object({ blockers: z.string().trim().max(2000, 'is too long') }).strict()
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

const updateProfile = z.object({ name }).strict()

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
  idParam,
  dateQuery,
  createTeam,
  addMember,
  updateProfile,
  changePassword,
  setRole,
  listEmployees,
  analyzeTeam,
  generateRetro
}
