const mongoose = require('mongoose')

/**
 * The written morning brief for one team (or the whole workspace) on one day.
 *
 * Kept, so opening the page shows the brief at once instead of waiting on the
 * model, and so the brief a lead read at eleven is the one still there at
 * four. The facts it was written from are kept beside it for the same reason.
 */
const dailyBriefSchema = new mongoose.Schema({
  // 'team:<id>' for a team, 'all' for everybody an admin sees
  scope: { type: String, required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  title: { type: String, default: '' },

  facts: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: { type: String, default: '' },
  model: { type: String, default: '' },

  generatedAt: { type: Date, default: Date.now },
  // null when the morning job wrote it
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  generatedByName: { type: String, default: '' }
}, { timestamps: true })

dailyBriefSchema.index({ scope: 1, date: 1 }, { unique: true })

module.exports = mongoose.models.DailyBrief || mongoose.model('DailyBrief', dailyBriefSchema)
