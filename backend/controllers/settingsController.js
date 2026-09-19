const audit = require('../services/auditService')
const { canUse } = require('../services/roleService')
const { saveSettings, settings } = require('../services/settingsService')

// GET /api/settings — the rules everybody works by; pay rules only for pay
const getSettings = async (req, res) => {
  try {
    const s = settings()
    const pay = await canUse(req.user, 'pay')
    res.json({
      office: s.office,
      leave: s.leave,
      holidays: s.holidays,
      company: s.company,
      ...(pay ? { pay: s.pay } : {}),
      updatedAt: s.updatedAt,
      updatedByName: s.updatedByName,
      canEdit: req.user.role === 'admin' && await canUse(req.user, 'settings')
    })
  } catch (err) {
    console.error('Get settings error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/settings — an admin changes them; they apply at once
const updateSettings = async (req, res) => {
  try {
    const { office, leave, pay, holidays, company } = req.body
    if (office && office.halfDayHours >= office.fullDayHours) {
      return res.status(400).json({ message: 'A half day has to be shorter than a full day' })
    }
    if (pay && pay.basicPercent + pay.hraPercent > 100) {
      return res.status(400).json({ message: 'Basic and HRA together cannot be more than 100%' })
    }
    if (holidays) {
      const dates = holidays.map(h => h.date)
      if (new Set(dates).size !== dates.length) {
        return res.status(400).json({ message: 'Two holidays are on the same day' })
      }
    }

    const saved = await saveSettings({
      ...(office ? { office } : {}),
      ...(leave ? { leave } : {}),
      ...(pay ? { pay } : {}),
      ...(holidays ? { holidays } : {}),
      ...(company ? { company } : {})
    }, req.user)

    await audit.record({
      action: 'settings.updated',
      actor: req.user,
      entityType: 'Settings',
      note: Object.keys(req.body).join(', ')
    })

    res.json({ message: 'Settings saved', settings: saved })
  } catch (err) {
    console.error('Update settings error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { getSettings, updateSettings }
