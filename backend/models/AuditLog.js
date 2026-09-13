const mongoose = require('mongoose')

/**
 * A record of who changed what.
 *
 * Standups are a team's account of its own days, so once they can be edited
 * the edits have to be visible — otherwise "I never said that" and "you
 * changed it after the fact" are both unanswerable. Role changes are here for
 * the same reason: they were only ever written to the server console, which
 * nobody reads and Render discards.
 *
 * Entries are written, never updated. Nothing in the app edits or deletes one.
 */
const ACTIONS = [
  'standup.updated',
  'standup.deleted',
  'user.role_changed',
  'timesheet.reviewed',
  'project.transfer',
  'user.record_updated',
  'role.created',
  'role.updated',
  'role.deleted'
]

const changeSchema = new mongoose.Schema({
  field: { type: String, required: true },
  from: { type: String, default: '' },
  to: { type: String, default: '' }
}, { _id: false })

const auditLogSchema = new mongoose.Schema({
  action: { type: String, enum: ACTIONS, required: true },

  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Denormalised so an entry still reads correctly after the account is
  // renamed or removed — the point of a log is that it survives the thing it
  // describes
  actorName: { type: String, default: '' },
  actorEmail: { type: String, default: '' },
  actorRole: { type: String, default: '' },

  // Whose record this was: the standup's author, or the user whose role moved
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  subjectName: { type: String, default: '' },

  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  entityType: { type: String, default: '' },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },

  // Field-level before and after. Kept as strings: this is a record to read,
  // not data to compute on, and a stringified value cannot go stale against a
  // later schema change.
  changes: { type: [changeSchema], default: [] },

  // Free-form context, e.g. the calendar date a standup covers
  note: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } })

// The two ways anyone reads this: one entity's trail, and a team's recent
// activity newest first
auditLogSchema.index({ entityId: 1, createdAt: -1 })
auditLogSchema.index({ team: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
module.exports.ACTIONS = ACTIONS
