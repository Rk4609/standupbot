const Review = require('../models/Review')
const ReviewCycle = require('../models/ReviewCycle')
const Team = require('../models/Team')
const User = require('../models/User')
const audit = require('../services/auditService')
const { notify, notifyMany } = require('../services/notifyService')
const { canUse } = require('../services/roleService')
const { reviewFacts } = require('../utils/reviewFacts')

const same = (a, b) => a != null && b != null && String(a) === String(b)
const isAdmin = (user) => user.role === 'admin'

/** Admins write anybody's but their own; a manager, the ones they were given. */
const mayReview = async (user, review) => {
  if (same(review.employee, user._id)) return false
  if (!(await canUse(user, 'team-reviews'))) return false
  if (isAdmin(user)) return true
  return user.role === 'manager' && same(review.reviewer, user._id)
}

/**
 * The review as this reader may see it. The manager's half reaches the
 * employee only once shared; the self-review reaches the manager only once
 * submitted, so neither side writes to match the other.
 */
const shape = (review, viewer) => {
  const out = { ...review, viewer }
  if (viewer === 'employee' && !['shared', 'acknowledged'].includes(review.status)) {
    out.manager = null
  }
  if (viewer === 'reviewer' && !review.self?.submittedAt) {
    out.self = null
  }
  return out
}

const cleanRatings = (input = {}) =>
  Object.fromEntries(Review.AREAS.map(a => [a, input[a] ?? null]))

/** Who writes this person's review: their team's manager, unless that is them. */
const reviewerFor = (person, managerOf) => {
  const manager = person.team ? managerOf.get(String(person.team)) : null
  return manager && !same(manager._id, person._id) ? manager : null
}

// GET /api/reviews/mine — my own reviews, newest first
const myReviews = async (req, res) => {
  try {
    const rows = await Review.find({ employee: req.user._id }).sort({ createdAt: -1 }).limit(20).lean()
    res.json({ reviews: rows.map(r => shape(r, 'employee')), areas: Review.AREAS })
  } catch (err) {
    console.error('My reviews error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// GET /api/reviews/:id — the owner or the reviewer; the facts only for the reviewer
const getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).lean()
    if (!review) return res.status(404).json({ message: 'No such review' })

    if (same(review.employee, req.user._id)) {
      return res.json({ review: shape(review, 'employee'), areas: Review.AREAS })
    }
    if (!(await mayReview(req.user, review))) return res.status(403).json({ message: 'That review is not yours to read' })

    const facts = await reviewFacts(review.employee, review.from, review.to)
    res.json({ review: shape(review, 'reviewer'), areas: Review.AREAS, facts })
  } catch (err) {
    console.error('Get review error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/reviews/:id/self — save, or with submit: true, hand it in
const saveSelf = async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, employee: req.user._id })
    if (!review) return res.status(404).json({ message: 'No such review' })
    if (review.status !== 'self') return res.status(400).json({ message: 'Your self-review is already in' })

    const { ratings, wins, improve, submit } = req.body
    review.self.ratings = cleanRatings(ratings)
    review.self.wins = wins ?? review.self.wins
    review.self.improve = improve ?? review.self.improve

    if (submit) {
      if (Review.AREAS.some(a => !review.self.ratings[a])) {
        return res.status(400).json({ message: 'Rate every area before handing it in' })
      }
      review.self.submittedAt = new Date()
      review.status = 'manager'
    }
    await review.save()

    if (submit) {
      const readers = review.reviewer
        ? [review.reviewer]
        : (await User.find({ role: 'admin' }).select('_id').lean()).map(a => a._id)
      await notifyMany(req.app.get('io'), readers.filter(id => !same(id, req.user._id)), {
        sender: req.user._id,
        type: 'review_submitted',
        message: `${review.employeeName} handed in their self-review for ${review.cycleName}`,
        link: `/reviews/${review._id}`
      })
    }

    res.json({ review: shape(review.toObject(), 'employee') })
  } catch (err) {
    console.error('Save self-review error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// PUT /api/reviews/:id/manager — the manager's half, as a draft until shared
const saveManager = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'No such review' })
    if (!(await mayReview(req.user, review))) return res.status(403).json({ message: 'That review is not yours to write' })
    if (['shared', 'acknowledged'].includes(review.status)) {
      return res.status(400).json({ message: 'It has been shared already' })
    }

    const { ratings, strengths, growth, overall } = req.body
    Object.assign(review.manager, {
      ratings: cleanRatings(ratings),
      strengths: strengths ?? review.manager.strengths,
      growth: growth ?? review.manager.growth,
      overall: overall ?? review.manager.overall,
      writtenBy: req.user._id,
      writtenByName: req.user.name
    })
    await review.save()
    res.json({ review: shape(review.toObject(), 'reviewer') })
  } catch (err) {
    console.error('Save manager review error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/reviews/:id/share — show it to the employee; no edits after
const shareReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'No such review' })
    if (!(await mayReview(req.user, review))) return res.status(403).json({ message: 'That review is not yours to share' })
    if (['shared', 'acknowledged'].includes(review.status)) {
      return res.status(400).json({ message: 'It has been shared already' })
    }
    const m = review.manager
    if (!m.overall || Review.AREAS.some(a => !m.ratings[a]) || m.strengths.trim().length < 3 || m.growth.trim().length < 3) {
      return res.status(400).json({ message: 'Rate every area, give an overall rating, and write strengths and what to grow first' })
    }

    review.status = 'shared'
    review.manager.sharedAt = new Date()
    await review.save()

    await audit.record({
      action: 'review.shared',
      actor: req.user,
      subject: { _id: review.employee, name: review.employeeName },
      team: review.team,
      entityType: 'Review',
      entityId: review._id,
      note: `${review.cycleName} · overall ${review.manager.overall}/5`
    })
    await notify(req.app.get('io'), {
      recipient: review.employee,
      sender: req.user._id,
      type: 'review_shared',
      message: `${req.user.name} shared your ${review.cycleName} review`,
      link: `/reviews/${review._id}`
    })

    res.json({ review: shape(review.toObject(), 'reviewer'), message: `Shared with ${review.employeeName}` })
  } catch (err) {
    console.error('Share review error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/reviews/:id/acknowledge — "I have read it", with a word back if they like
const acknowledgeReview = async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, employee: req.user._id })
    if (!review) return res.status(404).json({ message: 'No such review' })
    if (review.status !== 'shared') return res.status(400).json({ message: 'There is nothing to acknowledge yet' })

    review.status = 'acknowledged'
    review.acknowledgedAt = new Date()
    review.employeeComment = req.body.comment || ''
    await review.save()
    res.json({ review: shape(review.toObject(), 'employee') })
  } catch (err) {
    console.error('Acknowledge review error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

/* cycles ------------------------------------------------------------ */

// GET /api/reviews/cycles?cycle= — the rounds, and the reviews this person writes in one
const teamReviews = async (req, res) => {
  try {
    const cycles = await ReviewCycle.find().sort({ createdAt: -1 }).limit(20).lean()
    const cycle = cycles.find(c => same(c._id, req.query.cycle)) || cycles[0] || null

    let reviews = []
    if (cycle) {
      const filter = { cycle: cycle._id, employee: { $ne: req.user._id } }
      if (!isAdmin(req.user)) filter.reviewer = req.user._id
      reviews = await Review.find(filter).populate('team', 'name').sort({ employeeName: 1 })
        .select('employee employeeName team reviewerName status self.submittedAt manager.overall manager.sharedAt acknowledgedAt')
        .lean()
    }

    const count = (status) => reviews.filter(r => r.status === status).length
    res.json({
      cycles,
      cycle,
      reviews,
      progress: {
        total: reviews.length,
        self: count('self'),
        manager: count('manager'),
        shared: count('shared') + count('acknowledged')
      },
      canStart: isAdmin(req.user)
    })
  } catch (err) {
    console.error('Team reviews error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/reviews/cycles — an admin starts a round for everybody
const startCycle = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Only an admin starts a review round' })
    const { name, from, to, dueOn } = req.body
    if (from > to) return res.status(400).json({ message: 'The period ends before it starts' })

    const cycle = await ReviewCycle.create({ name, from, to, dueOn, createdBy: req.user._id, createdByName: req.user.name })

    const [people, teams] = await Promise.all([
      User.find({ role: { $in: ['employee', 'manager'] } }).select('name team').lean(),
      Team.find({ manager: { $ne: null } }).select('manager').populate('manager', 'name').lean()
    ])
    const managerOf = new Map(teams.filter(t => t.manager).map(t => [String(t._id), t.manager]))
    // A manager on no team of their own is reviewed by nobody but an admin
    const withTeam = await Promise.all(people.map(async p =>
      p.team ? p : { ...p, team: (await Team.findOne({ manager: p._id }).select('_id').lean())?._id || null }))

    await Review.insertMany(withTeam.map(p => {
      const reviewer = reviewerFor(p, managerOf)
      return {
        cycle: cycle._id,
        cycleName: name,
        from,
        to,
        employee: p._id,
        employeeName: p.name,
        team: p.team,
        reviewer: reviewer?._id || null,
        reviewerName: reviewer?.name || ''
      }
    }))

    await audit.record({
      action: 'review.cycle_started',
      actor: req.user,
      entityType: 'ReviewCycle',
      entityId: cycle._id,
      note: `${name} · ${from} to ${to} · ${withTeam.length} people`
    })

    const reviews = await Review.find({ cycle: cycle._id }).select('employee').lean()
    await Promise.all(reviews.map(r => notify(req.app.get('io'), {
      recipient: r.employee,
      sender: req.user._id,
      type: 'review_started',
      message: `${name} has started — write your self-review by ${dueOn}`,
      link: `/reviews/${r._id}`
    })))

    res.status(201).json({ cycle, people: withTeam.length, message: `${name} started for ${withTeam.length} people` })
  } catch (err) {
    console.error('Start review cycle error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

// POST /api/reviews/cycles/:id/close
const closeCycle = async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ message: 'Only an admin closes a review round' })
    const cycle = await ReviewCycle.findByIdAndUpdate(req.params.id, { status: 'closed' }, { returnDocument: 'after' })
    if (!cycle) return res.status(404).json({ message: 'No such round' })
    res.json({ cycle })
  } catch (err) {
    console.error('Close review cycle error:', err.message)
    res.status(500).json({ message: err.message })
  }
}

module.exports = {
  myReviews, getReview, saveSelf, saveManager, shareReview, acknowledgeReview,
  teamReviews, startCycle, closeCycle
}
