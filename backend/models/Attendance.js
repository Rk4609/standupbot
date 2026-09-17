const mongoose = require('mongoose')

/**
 * One person's working day: when they arrived and when they left.
 *
 * `date` is the calendar day in the person's own zone at check-in, so a
 * check-in at 9:30 in Pune is the 17th even though it is still the 16th in
 * UTC. Lateness and hours are not stored — they are read from the two times
 * against the policy, so a changed office start time does not leave old rows
 * saying the wrong thing.
 */
const correctionSchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  byName: { type: String, default: '' },
  at: { type: Date, default: Date.now },
  reason: { type: String, required: true, trim: true, maxlength: 300 }
}, { _id: false })

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: '' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },

  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  // The zone the day was read in, so the times can be shown as they were
  timezone: { type: String, default: 'UTC' },

  checkIn: { type: Date, required: true },
  checkOut: { type: Date, default: null },

  note: { type: String, default: '', trim: true, maxlength: 200 },

  // Set when a manager fixed the times, so the row says it was not the
  // person's own tap
  corrected: { type: correctionSchema, default: null }
}, { timestamps: true })

// One row a day per person, and a team's day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true })
attendanceSchema.index({ team: 1, date: 1 })

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema)
