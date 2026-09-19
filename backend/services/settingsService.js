const Settings = require('../models/Settings')
const { isWeekend } = require('../utils/time')

/**
 * The company's settings, readable without waiting.
 *
 * Attendance, leave and pay rules are worked out in plain functions all over
 * the app. Rather than make every one of them async, the settings are held
 * here and refreshed at most once a minute by a middleware in front of the
 * API, and at once whenever an admin saves them. Until the database has been
 * read, the defaults are the rules the app always used.
 */
const DEFAULTS = {
  office: { start: '10:00', graceMinutes: 15, fullDayHours: 8, halfDayHours: 4 },
  leave: { casual: 12, sick: 8, earned: 15 },
  pay: { basicPercent: 50, hraPercent: 20, pfRate: 12, pfWageCeiling: 15000, professionalTax: 200, professionalTaxFrom: 15000 },
  holidays: []
}

const REFRESH_MS = 60 * 1000

let current = structuredClone(DEFAULTS)
let holidayIndex = new Map()
let loadedAt = 0

const apply = (doc) => {
  current = {
    office: { ...DEFAULTS.office, ...(doc?.office || {}) },
    leave: { ...DEFAULTS.leave, ...(doc?.leave || {}) },
    pay: { ...DEFAULTS.pay, ...(doc?.pay || {}) },
    holidays: [...(doc?.holidays || [])].sort((a, b) => a.date.localeCompare(b.date)),
    updatedAt: doc?.updatedAt || null,
    updatedByName: doc?.updatedByName || ''
  }
  holidayIndex = new Map(current.holidays.map(h => [h.date, h.name]))
}

/** The settings as they stand. */
const settings = () => current

/** Read them again if the copy here is more than a minute old. */
const refreshSettings = async (force = false) => {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return current
  try {
    apply(await Settings.findOne({ key: 'company' }).lean())
    loadedAt = Date.now()
  } catch (err) {
    // Keep working on the last known rules rather than fail the request
    console.error('Settings refresh failed:', err.message)
  }
  return current
}

/** Save and use at once. */
const saveSettings = async (changes, actor) => {
  const doc = await Settings.findOneAndUpdate(
    { key: 'company' },
    { $set: { ...changes, updatedByName: actor?.name || '' } },
    { upsert: true, new: true, runValidators: true }
  ).lean()
  apply(doc)
  loadedAt = Date.now()
  return current
}

/** The holiday on a day, if any. */
const holidayOn = (date) => holidayIndex.get(date) || null

/** A day nobody is expected to work: a weekend or a company holiday. */
const isOffDay = (date) => isWeekend(date) || holidayIndex.has(date)

/** For tests: back to the defaults and a fresh read. */
const resetSettings = () => {
  apply(null)
  loadedAt = 0
}

module.exports = { DEFAULTS, settings, refreshSettings, saveSettings, holidayOn, isOffDay, resetSettings }
