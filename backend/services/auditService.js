const AuditLog = require('../models/AuditLog')

/** Values are stored as text, so a log entry reads the same in ten years. */
const asText = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

/**
 * The fields that actually moved, as before/after pairs.
 *
 * Only the named fields are compared, so adding a field to a model cannot
 * quietly start logging it.
 */
const diff = (before, after, fields) =>
  fields
    .map(field => ({ field, from: asText(before?.[field]), to: asText(after?.[field]) }))
    .filter(c => c.from !== c.to)

/**
 * Write one entry.
 *
 * A failure here is logged and swallowed: the audit trail must not be able to
 * fail the action it describes. An edit that succeeded but went unlogged is a
 * gap in the record; an edit rejected because the log was unavailable is lost
 * work for the person who wrote it.
 */
const record = async ({
  action,
  actor,
  subject = null,
  team = null,
  entityType = '',
  entityId = null,
  changes = [],
  note = ''
}) => {
  try {
    return await AuditLog.create({
      action,
      actor: actor._id,
      actorName: actor.name || '',
      actorEmail: actor.email || '',
      actorRole: actor.role || '',
      subject: subject?._id || subject || null,
      subjectName: subject?.name || '',
      team: team || null,
      entityType,
      entityId,
      changes,
      note
    })
  } catch (err) {
    console.error(`Audit log failed for ${action}:`, err.message)
    return null
  }
}

module.exports = { record, diff, asText }
