import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Team from '../models/Team.js'
import Standup from '../models/Standup.js'

let seq = 0

/** A saved user. The model hashes the password on save, so go through create. */
export const makeUser = async (overrides = {}) => {
  seq += 1
  return User.create({
    name: `User ${seq}`,
    email: `user${seq}.${Date.now()}@example.com`,
    password: 'secret123',
    role: 'employee',
    ...overrides
  })
}

export const makeTeam = async (manager, overrides = {}) =>
  Team.create({ name: `Team ${++seq}`, manager: manager?._id, ...overrides })

/** Put a user on a team on both sides of the relationship. */
export const joinTeam = async (user, team) => {
  await Team.updateOne({ _id: team._id }, { $addToSet: { members: user._id } })
  await User.updateOne({ _id: user._id }, { team: team._id })
  user.team = team._id
  return user
}

export const makeStandup = async (user, overrides = {}) =>
  Standup.create({
    user: user._id,
    team: user.team || null,
    yesterday: 'Shipped something',
    today: 'Shipping something else',
    blockers: 'None',
    hasBlocker: false,
    mood: 'good',
    date: new Date().toISOString().split('T')[0],
    ...overrides
  })

export const tokenFor = (user) =>
  jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' })

/** `.set(...authHeader(user))` on a supertest request. */
export const authHeader = (user) => ['Authorization', `Bearer ${tokenFor(user)}`]
