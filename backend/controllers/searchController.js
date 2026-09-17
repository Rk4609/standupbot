const Candidate = require('../models/Candidate')
const Leave = require('../models/Leave')
const Project = require('../models/Project')
const Standup = require('../models/Standup')
const SupportTicket = require('../models/SupportTicket')
const Team = require('../models/Team')
const User = require('../models/User')
const { canUse } = require('../services/roleService')
const { clip } = require('../utils/promptBudget')

const PER_KIND = 5

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isAdmin = (user) => user.role === 'admin'

/** The team a manager leads, or null. An admin is not scoped. */
const ledTeam = async (user) =>
  user.role === 'manager' ? (await Team.findOne({ manager: user._id }).select('_id').lean())?._id || null : null

/**
 * GET /api/search?q= — one box for everything this person may already read.
 *
 * Each kind of result follows the rule of the page it links to, checked here
 * again rather than trusted from the client: people and team leave only for
 * a lead with that module and only in their team, every support ticket only
 * for an admin, candidates only with hiring. What comes back never holds a
 * field the page itself would hide — no pay, no ticket bodies, no reasons
 * on somebody else's leave.
 */
const search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.json({ q, groups: [] })

    const rx = new RegExp(escapeRegex(q.slice(0, 60)), 'i')
    const user = req.user
    const lead = user.role === 'manager' || isAdmin(user)
    const team = await ledTeam(user)

    const [seePeople, seeProjects, seeTeamLeave, seeHiring, seeHistory, seeLeave] = await Promise.all([
      lead ? canUse(user, 'employees') : false,
      lead ? canUse(user, 'projects') : false,
      lead ? canUse(user, 'leaves') : false,
      lead ? canUse(user, 'hiring') : false,
      canUse(user, 'history'),
      canUse(user, 'leave')
    ])

    // A manager without a team sees nobody's records, like the pages do
    const teamScope = isAdmin(user) ? {} : team ? { team } : null

    const tasks = {
      people: seePeople && teamScope
        ? User.find({ ...teamScope, $or: [{ name: rx }, { email: rx }, { 'employment.position': rx }] })
          .select('name email employment.position team avatar')
          .populate('team', 'name')
          .sort({ name: 1 })
          .limit(PER_KIND)
          .lean()
          .then(rows => rows.map(p => ({
            id: String(p._id),
            title: p.name,
            detail: [p.employment?.position, p.team?.name].filter(Boolean).join(' · ') || p.email,
            to: `/employees?search=${encodeURIComponent(p.name)}`
          })))
        : [],

      projects: seeProjects && (isAdmin(user) || team)
        ? Project.find({
          ...(isAdmin(user) ? {} : { $or: [{ team: null }, { team }] }),
          $and: [{ $or: [{ name: rx }, { code: rx }, { client: rx }] }]
        })
          .select('name code client active')
          .sort({ active: -1, name: 1 })
          .limit(PER_KIND)
          .lean()
          .then(rows => rows.map(p => ({
            id: String(p._id),
            title: p.name,
            detail: [p.code, p.client, p.active ? '' : 'archived'].filter(Boolean).join(' · '),
            to: '/workspace/projects'
          })))
        : [],

      tickets: SupportTicket.find({
        ...(isAdmin(user) ? {} : { user: user._id }),
        $or: [{ subject: rx }, ...(isAdmin(user) ? [{ userName: rx }] : [])]
      })
        .select('subject status userName createdAt')
        .sort({ createdAt: -1 })
        .limit(PER_KIND)
        .lean()
        .then(rows => rows.map(t => ({
          id: String(t._id),
          title: t.subject,
          detail: [isAdmin(user) ? t.userName : '', t.status].filter(Boolean).join(' · '),
          to: '/support'
        }))),

      leave: Promise.all([
        seeLeave
          ? Leave.find({ user: user._id, $or: [{ reason: rx }, { type: rx }] })
            .select('type from to status').sort({ from: -1 }).limit(PER_KIND).lean()
          : [],
        seeTeamLeave && teamScope
          ? Leave.find({ ...teamScope, user: { $ne: user._id }, userName: rx })
            .select('userName type from to status').sort({ from: -1 }).limit(PER_KIND).lean()
          : []
      ]).then(([mine, theirs]) => [
        ...mine.map(l => ({
          id: String(l._id),
          title: `Your ${l.type} leave`,
          detail: `${l.from === l.to ? l.from : `${l.from} to ${l.to}`} · ${l.status}`,
          to: '/leave'
        })),
        ...theirs.map(l => ({
          id: String(l._id),
          title: `${l.userName} · ${l.type} leave`,
          detail: `${l.from === l.to ? l.from : `${l.from} to ${l.to}`} · ${l.status}`,
          to: '/leaves'
        }))
      ].slice(0, PER_KIND)),

      standups: seeHistory
        ? Standup.find({ user: user._id, $or: [{ today: rx }, { yesterday: rx }, { blockers: rx }] })
          .select('date today hasBlocker blockers')
          .sort({ date: -1 })
          .limit(PER_KIND)
          .lean()
          .then(rows => rows.map(s => ({
            id: String(s._id),
            title: clip(rx.test(s.today) ? s.today : s.hasBlocker ? s.blockers : s.today, 80),
            detail: `Your standup · ${s.date}`,
            to: '/history'
          })))
        : [],

      candidates: seeHiring
        ? Candidate.find({
          ...(isAdmin(user) ? {} : { submittedBy: user._id }),
          $or: [{ name: rx }, { position: rx }]
        })
          .select('name position status')
          .sort({ createdAt: -1 })
          .limit(PER_KIND)
          .lean()
          .then(rows => rows.map(c => ({
            id: String(c._id),
            title: c.name,
            detail: `${c.position} · ${c.status}`,
            to: isAdmin(user) && c.status === 'pending' ? '/workspace/approvals' : '/workspace/hiring'
          })))
        : []
    }

    const labels = {
      people: 'People',
      projects: 'Projects',
      tickets: 'Support',
      leave: 'Leave',
      standups: 'Standups',
      candidates: 'Hiring'
    }

    const keys = Object.keys(tasks)
    const found = await Promise.all(keys.map(k => tasks[k]))

    res.json({
      q,
      groups: keys
        .map((key, i) => ({ key, label: labels[key], results: found[i] }))
        .filter(g => g.results.length > 0)
    })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = { search }
