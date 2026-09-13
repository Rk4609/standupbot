/**
 * Fill in everybody's record: who they are, when they joined, what they do
 * and what they are paid.
 *
 *   node scripts/seed-records.js          # fill anything still empty
 *   node scripts/seed-records.js --force  # rewrite every record
 *   node scripts/seed-records.js --clear  # empty them again
 *
 * Nothing here is random twice: the values come from a hash of the account's
 * id, so re-running gives the same workspace rather than shuffling everybody's
 * salary. Existing data is left alone unless --force says otherwise, because
 * the point of a demo is to sit next to real records, not on top of them.
 */
require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const SupportTicket = require('../models/SupportTicket')
const User = require('../models/User')

const POSITIONS = {
  admin: [{ title: 'Head of engineering', band: 4 }],
  manager: [
    { title: 'Engineering manager', band: 3 },
    { title: 'Delivery manager', band: 3 },
    { title: 'Technical lead', band: 3 }
  ],
  employee: [
    { title: 'Frontend engineer', band: 2 },
    { title: 'Backend engineer', band: 2 },
    { title: 'Full-stack engineer', band: 2 },
    { title: 'QA engineer', band: 1 },
    { title: 'Data engineer', band: 2 },
    { title: 'ML engineer', band: 2 },
    { title: 'DevOps engineer', band: 2 },
    { title: 'UI designer', band: 1 },
    { title: 'Business analyst', band: 1 }
  ]
}

const DEPARTMENTS = ['Engineering', 'Engineering', 'Engineering', 'Design', 'Quality']

const CITIES = [
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302018' },
  { city: 'Bengaluru', state: 'Karnataka', pincode: '560034' },
  { city: 'Pune', state: 'Maharashtra', pincode: '411014' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
  { city: 'Indore', state: 'Madhya Pradesh', pincode: '452010' },
  { city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
  { city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' }
]

const STREETS = [
  'Flat 3B, Ashiana Residency',
  '12 Park Lane',
  '204 Sunrise Apartments',
  'House 8, Sector 21',
  'Flat 11, Green Meadows',
  '56 MG Road',
  'Plot 19, Vidhyadhar Nagar',
  'Flat 402, Lake View'
]

/** Salary by band, in rupees a year, before the per-person wobble. */
const BANDS = { 1: 600_000, 2: 1_100_000, 3: 2_000_000, 4: 3_200_000 }

/** Deterministic 0..1 from an id and a salt — same account, same record. */
const hash = (id, salt) => {
  const text = `${id}:${salt}`
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

const pick = (list, id, salt) => list[Math.floor(hash(id, salt) * list.length) % list.length]

const daysAgo = (n) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

const daysAhead = (n) => daysAgo(-n)

const clear = async () => {
  const res = await User.updateMany({}, {
    $set: {
      dob: null,
      phone: '',
      address: { line1: '', city: '', state: '', pincode: '', country: '' },
      employment: {
        employeeId: '', position: '', department: '', type: 'full-time',
        joinedOn: null, startsOn: null, endsOn: null, experienceYears: 0
      },
      salary: { amount: null, currency: 'INR', period: 'year', reviewedOn: null }
    }
  })
  console.log(`Emptied ${res.modifiedCount} records`)
}

const run = async () => {
  await connectDB()

  if (process.argv.includes('--clear')) {
    await clear()
    await mongoose.disconnect()
    return
  }

  const force = process.argv.includes('--force')
  const users = await User.find().select('_id name email role employment dob').lean()

  const ops = []
  let interns = 0
  let probation = 0

  for (const [i, user] of users.entries()) {
    const already = user.employment?.position || user.dob
    if (already && !force) continue

    const id = String(user._id)
    const job = pick(POSITIONS[user.role] || POSITIONS.employee, id, 'position')
    const place = pick(CITIES, id, 'city')

    // Most people are permanent. Every tenth is on an internship and every
    // fifteenth on probation, which is roughly what a growing team looks like
    // and, more to the point, gives the screen something to warn about.
    const roll = hash(id, 'type')
    const type = user.role !== 'employee'
      ? 'full-time'
      : roll < 0.1 ? 'intern' : roll < 0.17 ? 'probation' : roll < 0.22 ? 'contract' : 'full-time'

    // Permanent people joined anywhere in the last four years; an intern
    // joined recently, because that is what makes the end date near
    const joinedOn = type === 'intern'
      ? daysAgo(Math.floor(hash(id, 'joined') * 90) + 10)
      : type === 'probation'
        ? daysAgo(Math.floor(hash(id, 'joined') * 120) + 20)
        : daysAgo(Math.floor(hash(id, 'joined') * 1400) + 60)

    let startsOn = null
    let endsOn = null

    if (type === 'intern') {
      interns += 1
      startsOn = joinedOn
      // Three or six months, some of which land inside the warning window
      endsOn = new Date(joinedOn)
      endsOn.setMonth(endsOn.getMonth() + (hash(id, 'length') < 0.5 ? 3 : 6))
    } else if (type === 'probation') {
      probation += 1
      startsOn = joinedOn
      endsOn = new Date(joinedOn)
      endsOn.setMonth(endsOn.getMonth() + 6)
    }

    // Prior experience, roughly in step with the band
    const experienceYears = Number(
      (hash(id, 'experience') * (job.band === 1 ? 3 : job.band === 2 ? 7 : 12)).toFixed(1)
    )

    const base = BANDS[job.band]
    const amount = type === 'intern'
      ? Math.round((180_000 + hash(id, 'pay') * 120_000) / 6000) * 6000
      : Math.round((base * (0.85 + hash(id, 'pay') * 0.45)) / 10_000) * 10_000

    const born = new Date(1988, 0, 1)
    born.setDate(born.getDate() + Math.floor(hash(id, 'dob') * 5600))

    ops.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            dob: born,
            phone: `+91 ${70 + Math.floor(hash(id, 'phone') * 29)}${String(
              Math.floor(hash(id, 'phone2') * 100000000)
            ).padStart(8, '0')}`,
            address: {
              line1: pick(STREETS, id, 'street'),
              city: place.city,
              state: place.state,
              pincode: place.pincode,
              country: 'India'
            },
            employment: {
              employeeId: `EMP-${String(i + 1).padStart(3, '0')}`,
              position: job.title,
              department: user.role === 'admin' ? 'Engineering' : pick(DEPARTMENTS, id, 'dept'),
              type,
              joinedOn,
              startsOn,
              endsOn,
              experienceYears
            },
            salary: {
              amount,
              currency: 'INR',
              period: 'year',
              reviewedOn: daysAgo(Math.floor(hash(id, 'review') * 300) + 30)
            }
          }
        }
      }
    })
  }

  for (let i = 0; i < ops.length; i += 500) {
    await User.bulkWrite(ops.slice(i, i + 500))
  }

  console.log(
    `Filled ${ops.length} records (${interns} interns, ${probation} on probation); ` +
    `${users.length - ops.length} already had one`
  )

  /* ---- a couple of people asking for a correction ------------------ */

  const SUBJECTS = [
    'My phone number is out of date',
    'Wrong city on my record'
  ]
  await SupportTicket.deleteMany({ subject: { $in: SUBJECTS } })

  const askers = await User.find({ role: 'employee' }).select('name email team phone address').limit(2).lean()

  if (askers.length === 2) {
    await SupportTicket.insertMany([
      {
        user: askers[0]._id,
        userName: askers[0].name,
        userEmail: askers[0].email,
        team: askers[0].team || null,
        subject: SUBJECTS[0],
        body: 'I changed my number last month and the old one is still on my record.',
        category: 'data',
        kind: 'data-change',
        status: 'open',
        request: {
          field: 'phone',
          current: askers[0].phone || '',
          proposed: '+91 98330 41127'
        },
        createdAt: daysAgo(2)
      },
      {
        user: askers[1]._id,
        userName: askers[1].name,
        userEmail: askers[1].email,
        team: askers[1].team || null,
        subject: SUBJECTS[1],
        body: 'I moved to Pune when the office opened. The record still says my old city.',
        category: 'data',
        kind: 'data-change',
        status: 'open',
        request: {
          field: 'address.city',
          current: askers[1].address?.city || '',
          proposed: 'Pune'
        },
        createdAt: daysAgo(1)
      }
    ])
    console.log('Raised 2 change requests waiting for an admin')
  }

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
