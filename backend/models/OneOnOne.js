const mongoose = require('mongoose')

/**
 * A 1:1 between a manager and one of their people.
 *
 * Both add things to talk about and both tick off what was agreed. The notes
 * are shared; the private note is the manager's alone and never leaves the
 * server for the employee.
 */
const itemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['point', 'action'], required: true },
  text: { type: String, required: true, trim: true, maxlength: 300 },
  by: { type: String, enum: ['manager', 'employee'], required: true },
  // For an action: who does it
  owner: { type: String, enum: ['manager', 'employee', ''], default: '' },
  done: { type: Boolean, default: false },
  // Carried over, still open, from the last 1:1
  carried: { type: Boolean, default: false }
}, { _id: true })

const oneOnOneSchema = new mongoose.Schema({
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  managerName: { type: String, default: '' },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String, default: '' },

  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  time: { type: String, default: '', match: /^(\d{2}:\d{2})?$/ },
  status: { type: String, enum: ['upcoming', 'done'], default: 'upcoming' },

  items: { type: [itemSchema], default: [] },
  notes: { type: String, default: '', maxlength: 4000 },
  privateNote: { type: String, default: '', maxlength: 2000 },
  doneAt: { type: Date, default: null }
}, { timestamps: true })

oneOnOneSchema.index({ manager: 1, date: -1 })
oneOnOneSchema.index({ employee: 1, date: -1 })

module.exports = mongoose.models.OneOnOne || mongoose.model('OneOnOne', oneOnOneSchema)
