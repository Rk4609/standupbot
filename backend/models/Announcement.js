const mongoose = require('mongoose')

/**
 * A notice to everybody, or to one team, that stays on the dashboard until
 * each person says they have read it.
 */
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  important: { type: Boolean, default: false },

  // null for everybody; a team for that team only
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamName: { type: String, default: '' },

  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: '' },

  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  audienceCount: { type: Number, default: 0 }
}, { timestamps: true })

announcementSchema.index({ team: 1, createdAt: -1 })

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema)
