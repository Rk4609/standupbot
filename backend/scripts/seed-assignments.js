/**
 * Put people on projects, and fill the help desk with something to answer.
 *
 *   node scripts/seed-assignments.js          # create
 *   node scripts/seed-assignments.js --clear  # undo exactly this
 *
 * Assignments are derived from the hours already booked rather than invented:
 * whoever has been putting time against a project is who works on it. Made up
 * separately, the two would disagree, and the first thing anybody checks on
 * this screen is whether it matches what they did last week.
 *
 * One client project per team is deliberately left with nobody named, because
 * that is still a real state — it means the whole team may book to it — and a
 * demo where every project looks the same teaches the wrong thing.
 *
 * It also fills in today, so "who is on what today" has something to show.
 * --clear does not remove standups: it cannot tell the ones it wrote from the
 * ones a person filed, and deleting somebody's real entry to tidy up a demo
 * is not a trade worth making.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Project = require('../models/Project')
const Standup = require('../models/Standup')
const SupportTicket = require('../models/SupportTicket')
const Team = require('../models/Team')
const User = require('../models/User')

/** Reports somebody would actually file, in the words they would use. */
/** Plans and blockers that read like a working day rather than lorem. */
const PLANS = [
  'Finish the refund flow and get it in front of QA',
  'Pair with Rohit on the settlement report',
  'Clear the review comments on the orders table',
  'Cut over the last of the legacy filters',
  'Write the migration for the new schema and dry-run it',
  'Chase the client for the missing brand assets, then start the header',
  'Instrument the checkout so we can see where it drops',
  'Take the on-call handover and clear the alert backlog'
]

const BLOCKERS = [
  'Waiting on API credentials from the platform team',
  'Need a design review before I can continue',
  'Staging database is down again',
  'Blocked on the client signing off the copy'
]

const NOTES = ['', '', 'Client call', 'Review and fixes', 'Migration work', 'Pairing']

const TICKETS = [
  {
    subject: 'CSV export opens as one long column in Excel',
    category: 'bug',
    body: 'I export the team week from Analytics and every row lands in column A. Opening the same file in Google Sheets is fine, so I think it is the separator.',
    answer: 'Excel picks the separator from your Windows region setting. Open it with Data → From Text and choose comma, or use Sheets. We are looking at shipping a semicolon variant.',
    status: 'answered'
  },
  {
    subject: 'Yesterday field is gone from the standup form',
    category: 'question',
    body: 'There used to be three boxes and now there are two. Did I lose something, or was this on purpose?',
    answer: 'On purpose. Yesterday was being filled in from the previous day\'s plan by everybody, so it said nothing new. Your history still has every older entry.',
    status: 'closed'
  },
  {
    subject: 'Cannot open the Timesheets page',
    category: 'access',
    body: 'Clicking Timesheets in the sidebar throws me back to the dashboard. I need to approve my team for last week.',
    answer: 'You were still set to employee. I have moved you to manager — sign out and back in and it will be there.',
    status: 'closed'
  },
  {
    subject: 'Weekly retro says the model is busy',
    category: 'bug',
    body: 'Generating the retro on Friday afternoon fails about half the time with a message about the request being too large.',
    answer: 'That was us sending the whole week verbatim. The prompt is summarised now and the limit is not reached. Try it again and tell me if it comes back.',
    status: 'answered'
  },
  {
    subject: 'Hours do not add up to my week',
    category: 'question',
    body: 'My timesheet shows 32.5 hours but I worked five full days. I think the day I was at the client site is missing.',
    status: 'open'
  },
  {
    subject: 'Slack posts are going to the wrong channel',
    category: 'bug',
    body: 'Our blocker alerts land in #general instead of #standups. The webhook was set up months ago.',
    status: 'open'
  },
  {
    subject: 'Can we get a reminder before 10am?',
    category: 'other',
    body: 'Half the team fills the standup in after the call, which defeats the point. A nudge at 9:30 would fix it.',
    status: 'open'
  },
  {
    subject: 'Reset password email never arrived',
    category: 'access',
    body: 'I asked for a reset twice yesterday and nothing came, spam included.',
    answer: 'The sending domain was not verified, so nothing left the building. It is fixed — ask for one more and it should be with you in under a minute.',
    status: 'answered'
  }
]

const SUBJECTS = TICKETS.map(t => t.subject)

const clear = async () => {
  const projects = await Project.updateMany(
    { 'members.0': { $exists: true } },
    { $set: { members: [] } }
  )
  const tickets = await SupportTicket.deleteMany({ subject: { $in: SUBJECTS } })

  console.log(`Took everybody off ${projects.modifiedCount} projects`)
  console.log(`Removed ${tickets.deletedCount} support tickets`)
}

const run = async () => {
  await connectDB()

  if (process.argv.includes('--clear')) {
    await clear()
    await mongoose.disconnect()
    return
  }

  /* ---- who works on what ------------------------------------------- */

  const teams = await Team.find().populate('manager', 'name').lean()
  const users = await User.find().select('_id name email role team').lean()

  const teamOfUser = new Map(users.map(u => [String(u._id), u.team ? String(u.team) : null]))
  for (const team of teams) {
    if (team.manager) teamOfUser.set(String(team.manager._id), String(team._id))
  }

  // Who has actually booked time against each project, and how much
  const booked = await Standup.aggregate([
    { $unwind: '$work' },
    {
      $group: {
        _id: { user: '$user', project: '$work.project' },
        hours: { $sum: '$work.hours' }
      }
    }
  ])

  const clientProjects = await Project.find({ team: { $ne: null }, active: true })
    .select('_id name team').lean()
  const teamOfProject = new Map(clientProjects.map(p => [String(p._id), String(p.team)]))

  // One client project per team stays open to everybody — the state the app
  // had before anyone could be assigned, and still the right answer for work
  // the whole team dips into
  const leftOpen = new Set()
  for (const team of teams) {
    const first = clientProjects.find(p => String(p.team) === String(team._id))
    if (first) leftOpen.add(String(first._id))
  }

  /**
   * Everybody who ever booked an hour is not the squad.
   *
   * Two months of seeded hours have most of a team touching most of its
   * projects, and naming all of them says nothing — a project everybody is
   * on is a project nobody is responsible for. Each person is named on the
   * project they put the most time into, and on a second one only if it is a
   * real share of their time rather than a stray afternoon.
   */
  const byPerson = new Map()
  for (const row of booked) {
    const user = String(row._id.user)
    const project = String(row._id.project)
    if (!teamOfProject.has(project)) continue
    if (teamOfProject.get(project) !== teamOfUser.get(user)) continue

    if (!byPerson.has(user)) byPerson.set(user, [])
    byPerson.get(user).push({ project, hours: row.hours })
  }

  const members = new Map(clientProjects.map(p => [String(p._id), []]))

  for (const [user, rows] of byPerson) {
    rows.sort((a, b) => b.hours - a.hours)
    const [main, second] = rows

    for (const row of [main, second]) {
      if (!row) continue
      if (row !== main && row.hours < main.hours * 0.4) continue
      if (leftOpen.has(row.project)) continue
      members.get(row.project).push(new mongoose.Types.ObjectId(user))
    }
  }

  const ops = []
  let assigned = 0
  for (const [project, people] of members) {
    if (leftOpen.has(project)) continue
    ops.push({
      updateOne: { filter: { _id: project }, update: { $set: { members: people } } }
    })
    assigned += people.length
  }

  if (ops.length > 0) await Project.bulkWrite(ops)

  const sizes = [...members]
    .filter(([id]) => !leftOpen.has(id))
    .map(([, people]) => people.length)
    .join(', ')

  console.log(
    `Named ${assigned} people across ${ops.length} projects (${sizes}); ` +
    `${leftOpen.size} left open to their whole team`
  )

  /* ---- today, so the activity screen is not empty ------------------ */

  const today = new Date().toISOString().slice(0, 10)

  const already = await Standup.find({ date: today }).select('user').lean()
  const filed = new Set(already.map(s => String(s.user)))

  const assignedTo = new Map()
  for (const [project, people] of members) {
    for (const person of people) {
      if (!assignedTo.has(String(person))) assignedTo.set(String(person), [])
      assignedTo.get(String(person)).push(project)
    }
  }

  const sharedProjects = await Project.find({ team: null, active: true })
    .select('_id name').lean()
  const meetings = sharedProjects.find(p => /meeting/i.test(p.name)) || sharedProjects[0]

  const employees = users.filter(u => u.role !== 'admin' && !filed.has(String(u._id)))

  const todayDocs = []
  for (const [i, person] of employees.entries()) {
    // Not everybody reports every day, and a screen that claims they do is
    // not worth opening
    if (i % 5 === 0) continue

    const own = assignedTo.get(String(person._id)) || []
    const main = own[i % Math.max(1, own.length)]
    const hasBlocker = i % 6 === 0

    const work = []
    if (main) work.push({ project: main, hours: 6, note: NOTES[i % NOTES.length] })
    if (meetings) {
      work.push({ project: meetings._id, hours: main ? 1.5 : 4, note: 'Standup and planning' })
    }

    todayDocs.push({
      user: person._id,
      team: teamOfUser.get(String(person._id)) || null,
      yesterday: '',
      today: PLANS[i % PLANS.length],
      blockers: hasBlocker ? BLOCKERS[i % BLOCKERS.length] : 'None',
      hasBlocker,
      mood: ['great', 'good', 'good', 'okay', 'stressed'][i % 5],
      date: today,
      work
    })
  }

  if (todayDocs.length > 0) {
    await Standup.insertMany(todayDocs, { ordered: false })
  }
  console.log(
    `Filed ${todayDocs.length} standups for ${today} ` +
    `(${todayDocs.filter(d => d.hasBlocker).length} with a blocker); ` +
    `${filed.size} were already there`
  )

  /* ---- something for the help desk to answer ----------------------- */

  await SupportTicket.deleteMany({ subject: { $in: SUBJECTS } })

  const admin = users.find(u => u.role === 'admin')
  if (!admin) {
    console.warn('No admin account — tickets will have no answers on them')
  }

  // Spread across whoever is not the admin, so the queue is not one person
  const reporters = users.filter(u => String(u._id) !== String(admin?._id))
  if (reporters.length === 0) {
    console.error('Nobody to raise a ticket. Seed users first.')
    await mongoose.disconnect()
    process.exit(1)
  }

  const now = Date.now()
  const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000)

  const docs = TICKETS.map((t, i) => {
    const reporter = reporters[i % reporters.length]
    const raised = daysAgo(TICKETS.length - i)

    const replies = t.answer && admin
      ? [{
          author: admin._id,
          authorName: admin.name,
          authorRole: 'admin',
          body: t.answer,
          createdAt: new Date(raised.getTime() + 3 * 60 * 60 * 1000)
        }]
      : []

    return {
      user: reporter._id,
      userName: reporter.name,
      userEmail: reporter.email || '',
      team: teamOfUser.get(String(reporter._id)) || null,
      subject: t.subject,
      body: t.body,
      category: t.category,
      status: t.status,
      replies,
      lastReplyAt: replies[0]?.createdAt || null,
      lastReplyBy: replies[0]?.authorName || '',
      createdAt: raised
    }
  })

  const created = await SupportTicket.insertMany(docs)
  const open = created.filter(t => t.status === 'open').length

  console.log(`Raised ${created.length} tickets, ${open} of them still waiting`)

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
