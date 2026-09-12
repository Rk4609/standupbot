const mongoose = require('mongoose')

const retroSchema = new mongoose.Schema({
  team:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamName: { type: String, default: 'All Teams' },

  // Monday and Friday of the week, as 'YYYY-MM-DD'
  weekStart: { type: String, required: true },
  weekEnd:   { type: String, required: true },
  weekLabel: { type: String, required: true }, // e.g. "Week 37 · Sep 8–12"

  content: { type: String, required: true },

  stats: {
    submissions:       { type: Number, default: 0 },
    activeMembers:     { type: Number, default: 0 },
    totalMembers:      { type: Number, default: 0 },
    participationRate: { type: Number, default: 0 }, // percent, 0-100
    blockerCount:      { type: Number, default: 0 },
    moodBreakdown:     { type: Object, default: {} }
  },

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true })

// One retro per team per week — regenerating overwrites rather than piling up
retroSchema.index({ team: 1, weekStart: 1 }, { unique: true })

module.exports = mongoose.model('Retro', retroSchema)
