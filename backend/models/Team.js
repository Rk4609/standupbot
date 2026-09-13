const mongoose = require('mongoose')

const teamSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  standupTime: { type: String, default: '09:00' } // reminder time
}, { timestamps: true })

// "Which team does this lead run" is asked on nearly every manager request —
// the template, the analytics scope, the audit scope, the timesheet review
teamSchema.index({ manager: 1 })

// Reuse an already-compiled model. The same file can be reached both as CJS
// (require, from the controllers) and as ESM (import, from the tests), which
// would otherwise register the schema twice and throw OverwriteModelError.
module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema)