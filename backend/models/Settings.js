const mongoose = require('mongoose')

/**
 * How this company works: office hours, leave allowances, how pay is split,
 * and the days the office is closed. One document, edited by an admin.
 */
const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  name: { type: String, required: true, trim: true, maxlength: 80 }
}, { _id: false })

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'company', unique: true },

  office: {
    start: { type: String, default: '10:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    graceMinutes: { type: Number, default: 15, min: 0, max: 180 },
    fullDayHours: { type: Number, default: 8, min: 1, max: 16 },
    halfDayHours: { type: Number, default: 4, min: 1, max: 12 }
  },

  leave: {
    casual: { type: Number, default: 12, min: 0, max: 365 },
    sick: { type: Number, default: 8, min: 0, max: 365 },
    earned: { type: Number, default: 15, min: 0, max: 365 }
  },

  pay: {
    basicPercent: { type: Number, default: 50, min: 1, max: 100 },
    hraPercent: { type: Number, default: 20, min: 0, max: 100 },
    pfRate: { type: Number, default: 12, min: 0, max: 50 },
    pfWageCeiling: { type: Number, default: 15000, min: 0 },
    professionalTax: { type: Number, default: 200, min: 0 },
    professionalTaxFrom: { type: Number, default: 15000, min: 0 }
  },

  holidays: { type: [holidaySchema], default: [] },

  // Printed on letters: who the company is and who signs
  company: {
    name: { type: String, default: 'StandupBot', trim: true, maxlength: 120 },
    address: { type: String, default: '', trim: true, maxlength: 300 },
    email: { type: String, default: '', trim: true, maxlength: 120 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    signatory: { type: String, default: '', trim: true, maxlength: 80 },
    signatoryTitle: { type: String, default: 'HR Manager', trim: true, maxlength: 80 },
    letterPrefix: { type: String, default: 'HR', trim: true, maxlength: 12 }
  },

  updatedByName: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema)
