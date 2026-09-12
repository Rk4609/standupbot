const { z } = require('zod')

/**
 * Validate and replace req.body / req.query / req.params from a zod schema.
 *
 * Controllers were each hand-rolling their own checks, so the rules drifted:
 * some endpoints checked a field, others took whatever arrived. Parsing here
 * also strips unknown keys, so a request cannot smuggle extra fields into a
 * create or update.
 */
const validate = (schemas) => (req, res, next) => {
  for (const source of ['body', 'query', 'params']) {
    const schema = schemas[source]
    if (!schema) continue

    const result = schema.safeParse(req[source])

    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue.path.join('.')
      return res.status(400).json({
        message: field ? `${field}: ${issue.message}` : issue.message,
        // The full list is there for a client that wants to mark fields
        errors: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      })
    }

    // req.query is a getter on Express 5, so assign its contents rather than
    // replacing the object itself
    if (source === 'query') {
      for (const key of Object.keys(req.query)) delete req.query[key]
      Object.assign(req.query, result.data)
    } else {
      req[source] = result.data
    }
  }

  next()
}

/* ------------------------------------------------------------------ */
/* Shared field rules                                                   */
/* ------------------------------------------------------------------ */

const email = z
  .string()
  .trim()
  .min(1, 'is required')
  .email('must be a valid email address')
  .max(200)
  .toLowerCase()

const password = z
  .string()
  .min(6, 'must be at least 6 characters')
  .max(200, 'is too long')

const name = z.string().trim().min(1, 'is required').max(100, 'is too long')

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'is not a valid id')

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')

module.exports = { validate, z, fields: { email, password, name, objectId, isoDate } }
