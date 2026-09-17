const mongoose = require('mongoose')

/**
 * A week's written status report for one team (or everybody), kept once made
 * so the page opens on it and the PDF somebody forwarded on Friday is still
 * the one there on Monday.
 */
const weeklyReportSchema = new mongoose.Schema({
  // 'team:<id>' or 'all', the same scopes as the daily brief
  scope: { type: String, required: true },
  weekStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  title: { type: String, default: '' },

  facts: { type: mongoose.Schema.Types.Mixed, default: {} },
  content: { type: String, default: '' },
  model: { type: String, default: '' },

  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  generatedByName: { type: String, default: '' }
}, { timestamps: true })

weeklyReportSchema.index({ scope: 1, weekStart: 1 }, { unique: true })

module.exports = mongoose.models.WeeklyReport || mongoose.model('WeeklyReport', weeklyReportSchema)
