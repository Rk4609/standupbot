import { afterAll, afterEach, beforeAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { resetRateLimits } from '../middleware/rateLimiters.js'

let mongo

beforeAll(async () => {
  // Controllers read these at call time, so they must exist before any test
  process.env.JWT_SECRET ||= 'test-secret-key-for-vitest'
  process.env.CLIENT_URL ||= 'http://localhost:5173'
  process.env.NODE_ENV = 'test'

  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})

// A clean database and fresh rate-limit counters per test, so order never
// matters and one suite's requests cannot exhaust another's budget
afterEach(async () => {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map(c => c.deleteMany({})))
  resetRateLimits()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
})
