/**
 * Give the most recent joiners an onboarding checklist, part way through.
 *
 *   node scripts/seed-onboarding.js          # people without a checklist
 *   node scripts/seed-onboarding.js --force  # remove all checklists first
 *
 * Takes the six latest joiners, plus the demo employee account so there is
 * one to sign in and see. Tasks already due are mostly ticked, by whoever
 * owns them; one or two are left late so "overdue" has something to show.
 * Written straight to the database: nobody is notified.
 */
require('dotenv').config()
const crypto = require('crypto')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Onboarding = require('../models/Onboarding')
const Team = require('../models/Team')
const User = require('../models/User')
const { tasksFor } = require('../utils/onboardingPlan')
const { todayIn } = require('../utils/time')

const DEMO_EMPLOYEE = 'ira.menon@demo.standupbot.local'

const roll = (...parts) =>
  crypto.createHash('sha1').update(parts.join(':')).digest().readUInt32BE(0)

const main = async () => {
  await connectDB()
  if (process.argv.includes('--force')) {
    const { deletedCount } = await Onboarding.deleteMany({})
    console.log(`Removed ${deletedCount} checklists`)
  }

  const today = todayIn('Asia/Kolkata')
  const admin = await User.findOne({ role: 'admin' }).select('name').lean()

  const latest = await User.find({ role: 'employee', 'employment.joinedOn': { $ne: null } })
    .select('name email team employment')
    .sort({ 'employment.joinedOn': -1 })
    .limit(6)
    .lean()
  const demo = await User.findOne({ email: DEMO_EMPLOYEE }).select('name email team employment').lean()
  const people = [...latest, ...(demo && !latest.some(p => p.email === DEMO_EMPLOYEE) ? [demo] : [])]

  let created = 0
  for (const person of people) {
    if (await Onboarding.exists({ user: person._id })) continue

    const team = person.team ? await Team.findById(person.team).select('manager').lean() : null
    const manager = team?.manager ? await User.findById(team.manager).select('name').lean() : null

    // The demo account starts this week, so its checklist is fresh
    const joined = person.email === DEMO_EMPLOYEE
      ? todayIn('Asia/Kolkata', new Date(Date.now() - 3 * 86_400_000))
      : new Date(person.employment.joinedOn).toISOString().slice(0, 10)

    const doerOf = { hr: admin, manager: manager || admin, employee: person }

    const tasks = tasksFor(joined).map((task, i) => {
      const due = task.dueOn <= today
      // Most tasks already due are done; about one in five is left late
      const done = due && roll(person._id, i) % 5 !== 0
      const doer = doerOf[task.owner]
      return {
        ...task,
        done,
        doneBy: done ? doer?._id : null,
        doneByName: done ? doer?.name || '' : '',
        doneAt: done ? new Date(`${task.dueOn}T11:00:00.000Z`) : null
      }
    })

    const complete = tasks.every(t => t.done)
    await Onboarding.create({
      user: person._id,
      userName: person.name,
      position: person.employment?.position || '',
      team: person.team || null,
      startsOn: joined,
      tasks,
      status: complete ? 'complete' : 'active',
      completedAt: complete ? new Date() : null,
      startedBy: admin?._id || null,
      startedByName: admin?.name || ''
    })
    created += 1
  }

  console.log(`Created ${created} checklists · ${await Onboarding.countDocuments({ status: 'active' })} active`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
