const Standup = require('../models/Standup')
const User = require('../models/User')
const Team = require('../models/Team')
const Notification = require('../models/Notification')
const AuditLog = require('../models/AuditLog')
const { addDays, lastNDates, todayIn, zoneOf } = require('../utils/time')
const audit = require('../services/auditService')
const { resolveTemplate, teamForUser } = require('./templateController')
const { CORE_KEYS } = require('../models/StandupTemplate')
const slack = require('../services/slackService')

/** The fields an edit may touch, and the ones the audit trail compares. */
const EDITABLE = ['yesterday', 'today', 'blockers', 'mood']

// ✅ Helper
const getTeamId = async (user) => {
  if (user.role === 'employee' && user.team) return user.team
  if (user.role === 'manager') {
    const team = await Team.findOne({ manager: user._id })
    return team?._id || null
  }
  return null // admin
}

// ✅ Helper — kya yeh user is standup ko modify kar sakta hai?
// Admin sab kuch, manager sirf apni team ka
const canModifyStandup = async (user, standup) => {
  if (user.role === 'admin') return true
  const teamId = await getTeamId(user)
  if (!teamId || !standup.team) return false
  return standup.team.toString() === teamId.toString()
}

/**
 * The team a standup being written belongs to.
 *
 * Separate from getTeamId because that one answers "what may this person
 * see", where an admin means everything and so returns null. For a standup
 * being written, an admin who runs a team is filing it in that team.
 */
const teamForSubmission = async (user) => {
  const scoped = await getTeamId(user)
  if (scoped) return scoped

  const managed = await Team.findOne({ manager: user._id }).select('_id')
  return managed?._id || null
}

/**
 * Whether a blockers field actually describes a blocker.
 *
 * Returns a real boolean: the chained `&&` used here before yielded the empty
 * string when the field was blank, which mongoose then refused to cast.
 */
const describesBlocker = (blockers) => {
  const text = (blockers || '').trim()
  return text !== '' && text.toLowerCase() !== 'none'
}

/**
 * Who may edit this standup, and until when.
 *
 * The author gets the day the standup covers — long enough to fix a typo or
 * add the blocker they forgot, short enough that the record of a past day is
 * not quietly rewritten a week later. After that it takes a manager, and
 * every edit is in the audit trail either way.
 */
const canEditStandup = async (user, standup) => {
  const isAuthor = String(standup.user) === String(user._id)

  if (isAuthor) {
    if (standup.date === todayIn(zoneOf(user))) return { allowed: true }
    return {
      allowed: false,
      status: 403,
      message: 'You can only edit a standup on the day it covers. Ask your manager to change an older one.'
    }
  }

  if (await canModifyStandup(user, standup)) return { allowed: true }

  return {
    allowed: false,
    status: 403,
    message: 'Access denied — this standup is not yours'
  }
}

// POST /api/standups
const submitStandup = async (req, res) => {
  try {
    const { yesterday, today, blockers, mood, answers = {} } = req.body

    // The day this standup belongs to is the submitter's day, not the
    // server's — those differ for most of the world for part of every day
    const zone = zoneOf(req.user)
    const today_date = todayIn(zone)

    // Which questions were actually asked decides what must be answered. The
    // form is built from the same template, so validating against the fixed
    // three would either demand something nobody was shown or let a team's
    // own required question through empty.
    // getTeamId, not req.user.team: a manager's own `team` field is empty —
    // they are linked to their team as its manager instead — so reading the
    // field directly filed their standup with no team at all, keeping it out
    // of their own team view and out of anything the team is notified about.
    const teamId = await teamForSubmission(req.user)

    const template = await resolveTemplate(await teamForUser(req.user))
    const given = { yesterday, today, blockers, ...answers }

    const unanswered = template.questions
      .filter(q => q.required && !String(given[q.key] || '').trim())
      .map(q => q.label)

    if (unanswered.length > 0) {
      return res.status(400).json({
        message: `Please answer: ${unanswered.join(', ')}`
      })
    }

    const exists = await Standup.findOne({ user: req.user._id, date: today_date })
    if (exists) {
      return res.status(400).json({ message: "Today's standup is already submitted!" })
    }

    const hasBlocker = describesBlocker(blockers)

    const standup = await Standup.create({
      user: req.user._id,
      team: teamId,
      yesterday: yesterday || '',
      today,
      blockers: blockers || 'None',
      hasBlocker,
      mood: mood || 'good',
      date: today_date,
      // Only the team's own questions — the core three have their own fields
      answers: Object.fromEntries(
        template.questions
          .filter(q => !CORE_KEYS.includes(q.key))
          .map(q => [q.key, String(answers[q.key] || '').trim()])
          .filter(([, value]) => value !== '')
      )
    })

    if (teamId) {
      const team = await Team.findById(teamId).populate('manager')
      if (team?.manager) {
        // Absent when the app is mounted without a socket server (tests).
        // A missing realtime hub must not fail the submission itself.
        const io = req.app.get('io')

        const notification = await Notification.create({
          recipient: team.manager._id,
          sender: req.user._id,
          type: 'standup_submitted',
          message: `${req.user.name} submitted their daily standup`,
          link: '/team'
        })

        io?.to(team.manager._id.toString()).emit('new-notification', {
          _id: notification._id,
          message: notification.message,
          type: notification.type,
          isRead: false,
          createdAt: notification.createdAt,
          link: notification.link
        })

        if (hasBlocker) {
          const blockerNotif = await Notification.create({
            recipient: team.manager._id,
            sender: req.user._id,
            type: 'blocker_added',
            message: `🚨 ${req.user.name} has a blocker: ${blockers}`,
            link: '/blockers'
          })

          io?.to(team.manager._id.toString()).emit('new-notification', {
            _id: blockerNotif._id,
            message: blockerNotif.message,
            type: blockerNotif.type,
            isRead: false,
            createdAt: blockerNotif.createdAt,
            link: blockerNotif.link
          })
        }
      }
    }

    const user = await User.findById(req.user._id)

    // Compare calendar days, not instants. `lastSubmission` is kept in step
    // for anything still reading it, but it cannot decide "yesterday" on its
    // own — accounts created before this field fall back to reading it in the
    // user's zone, so nobody loses a streak to the upgrade.
    const lastDate =
      user.lastStandupDate ||
      (user.lastSubmission ? todayIn(zone, user.lastSubmission) : null)

    const newStreak = lastDate === addDays(today_date, -1) ? (user.streak || 0) + 1 : 1

    await User.updateOne(
      { _id: req.user._id },
      { streak: newStreak, lastSubmission: new Date(), lastStandupDate: today_date }
    )

    // Deliberately not awaited. The standup is already saved and the person
    // is owed their response now; making them wait on hooks.slack.com — up to
    // the service's timeout when Slack is down — would be letting a side
    // effect hold up the thing it is a side effect of. notifyTeam swallows
    // its own failures and records them on the integration, so there is
    // nothing here to catch and nothing to reject.
    if (teamId) {
      const plain = standup.toObject()
      slack.notifyTeam(teamId, 'standupSubmitted', slack.standupMessage(plain, req.user))
      if (hasBlocker) {
        slack.notifyTeam(teamId, 'blockerRaised', slack.blockerMessage(plain, req.user))
      }
    }

    res.status(201).json(standup)
  } catch (err) {
    console.error('Standup submit error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/my
const getMyStandups = async (req, res) => {
  try {
    const standups = await Standup.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
    res.json(standups)
  } catch (err) {
    console.error('Get standups error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/team
const getTeamStandups = async (req, res) => {
  try {
    const filter = {}

    if (req.user.role === 'admin') {
      console.log('Admin — showing all standups')
    } else {
      const teamId = await getTeamId(req.user)
      if (!teamId) {
        return res.status(400).json({ message: 'You are not part of any team!' })
      }
      filter.team = teamId
    }

    const { date } = req.query
    if (date) filter.date = date

    const standups = await Standup.find(filter)
      .populate('user', 'name email streak')
      .sort({ createdAt: -1 })
    res.json(standups)
  } catch (err) {
    console.error('Team standups error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/blockers
const getBlockers = async (req, res) => {
  try {
    const filter = { hasBlocker: true }

    if (req.user.role !== 'admin') {
      const teamId = await getTeamId(req.user)
      if (!teamId) {
        return res.status(400).json({ message: 'You are not part of any team!' })
      }
      filter.team = teamId
    }

    const standups = await Standup.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
    res.json(standups)
  } catch (err) {
    console.error('Blockers error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/stats
const getTeamStats = async (req, res) => {
  try {
    // "The last 7 days" means the viewer's last 7 days
    const last7 = lastNDates(7, zoneOf(req.user))

    const filter = {}

    if (req.user.role === 'admin') {
      console.log('Admin — showing all stats')
    } else {
      const teamId = await getTeamId(req.user)
      if (!teamId) {
        return res.status(400).json({ message: 'You are not part of any team!' })
      }
      filter.team = teamId
    }

    const stats = await Promise.all(last7.map(async (date) => {
      const count = await Standup.countDocuments({ ...filter, date })
      console.log(`Date: ${date} → Count: ${count}`)
      return { date, count }
    }))

    res.json(stats)
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ message: err.message })
  }
}

//  PUT /api/standups/:id/blocker — Blocker edit karo (admin)
const updateBlocker = async (req, res) => {
  try {
    const { blockers } = req.body

    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    if (!(await canModifyStandup(req.user, standup))) {
      return res.status(403).json({ message: 'Access denied — this standup is not from your team' })
    }

    const hasBlocker = describesBlocker(blockers)

    standup.blockers = blockers || 'None'
    standup.hasBlocker = hasBlocker
    await standup.save()

    res.json({ message: 'Blocker updated successfully', standup })
  } catch (err) {
    console.error('Update blocker error:', err)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/standups/:id — edit a standup, leaving a trail
const updateStandup = async (req, res) => {
  try {
    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    const verdict = await canEditStandup(req.user, standup)
    if (!verdict.allowed) {
      return res.status(verdict.status).json({ message: verdict.message })
    }

    // A team's own answers are as editable as the core three, and the trail
    // has to show them changing by the same names the team gave them
    const answerKeys = [...new Set([
      ...standup.answers?.keys() || [],
      ...Object.keys(req.body.answers || {})
    ])]
    const fields = [...EDITABLE, ...answerKeys]

    const snapshot = () => ({
      ...EDITABLE.reduce((acc, f) => ({ ...acc, [f]: standup[f] }), {}),
      ...answerKeys.reduce((acc, k) => ({ ...acc, [k]: standup.answers?.get(k) || '' }), {})
    })

    const before = snapshot()

    for (const field of EDITABLE) {
      if (req.body[field] !== undefined) standup[field] = req.body[field]
    }
    for (const [key, value] of Object.entries(req.body.answers || {})) {
      if (!standup.answers) standup.answers = new Map()
      standup.answers.set(key, String(value).trim())
    }
    standup.blockers = standup.blockers || 'None'
    standup.hasBlocker = describesBlocker(standup.blockers)

    const changes = audit.diff(before, snapshot(), fields)

    // Nothing moved, so there is nothing to record and nothing to save
    if (changes.length === 0) {
      return res.json({ message: 'No changes', standup })
    }

    await standup.save()

    const author = await User.findById(standup.user).select('name email')
    await audit.record({
      action: 'standup.updated',
      actor: req.user,
      subject: author,
      team: standup.team,
      entityType: 'Standup',
      entityId: standup._id,
      changes,
      note: standup.date
    })

    res.json({ message: 'Standup updated', standup })
  } catch (err) {
    console.error('Update standup error:', err)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/standups/:id/history — the edit trail for one standup
const getStandupHistory = async (req, res) => {
  try {
    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    // Anyone who could edit it can see how it got this way. The author reads
    // their own trail even once their edit window has closed.
    const isAuthor = String(standup.user) === String(req.user._id)
    if (!isAuthor && !(await canModifyStandup(req.user, standup))) {
      return res.status(403).json({ message: 'Access denied — this standup is not yours' })
    }

    const entries = await AuditLog.find({ entityId: standup._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    res.json(entries)
  } catch (err) {
    console.error('Standup history error:', err)
    res.status(500).json({ message: err.message })
  }
}

//  DELETE /api/standups/:id — Standup delete karo (admin)
const deleteBlocker = async (req, res) => {
  try {
    const standup = await Standup.findById(req.params.id)
    if (!standup) {
      return res.status(404).json({ message: 'Standup not found' })
    }

    if (!(await canModifyStandup(req.user, standup))) {
      return res.status(403).json({ message: 'Access denied — this standup is not from your team' })
    }

    const author = await User.findById(standup.user).select('name email')

    await Standup.findByIdAndDelete(req.params.id)

    // Recorded after the fact and with the content inline: once the document
    // is gone the trail is the only place that says what was removed
    await audit.record({
      action: 'standup.deleted',
      actor: req.user,
      subject: author,
      team: standup.team,
      entityType: 'Standup',
      entityId: standup._id,
      changes: EDITABLE.map(f => ({ field: f, from: audit.asText(standup[f]), to: '' })),
      note: standup.date
    })

    res.json({ message: 'Standup deleted successfully' })
  } catch (err) {
    console.error('Delete standup error:', err)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  submitStandup,
  getMyStandups,
  getTeamStandups,
  getBlockers,
  getTeamStats,
  updateBlocker,
  updateStandup,
  getStandupHistory,
  deleteBlocker
}