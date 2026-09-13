const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const { apiLimiter } = require('./middleware/rateLimiters')

/** Origins the browser client may call from. */
const allowedOrigins = () =>
  [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.CLIENT_URL
  ].filter(Boolean)

/**
 * Build the Express app.
 *
 * Kept separate from server.js so tests can mount it with supertest without
 * opening a port, connecting to the real database or starting the cron jobs.
 *
 * `globalRateLimit` is off under test: a suite makes hundreds of requests in
 * seconds and would trip the 200/min backstop. The per-route auth limiters
 * stay on either way, because their behaviour is itself under test.
 */
const createApp = ({ globalRateLimit = true } = {}) => {
  const app = express()

  // Render terminates TLS and forwards the client IP in X-Forwarded-For.
  // Without this the rate limiters would count every request against the
  // proxy's own IP.
  app.set('trust proxy', 1)

  // Security headers. The API serves JSON and SSE, never HTML, so CSP and
  // COEP have nothing to protect here and only complicate the cross-origin
  // setup.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }))

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, supertest)
      if (!origin) return callback(null, true)
      if (allowedOrigins().includes(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))

  // A standup body is a few KB; the default 100kb is already generous
  app.use(express.json({ limit: '100kb' }))

  if (globalRateLimit) app.use('/api', apiLimiter)

  app.use('/api/auth', require('./routes/authRoutes'))
  app.use('/api/standups', require('./routes/standupRoutes'))
  app.use('/api/teams', require('./routes/teamRoutes'))
  app.use('/api/users', require('./routes/userRoutes'))
  app.use('/api/notifications', require('./routes/notificationRoutes'))
  app.use('/api/ai', require('./routes/aiRoutes'))
  app.use('/api/retro', require('./routes/retroRoutes'))
  app.use('/api/employees', require('./routes/employeeRoutes'))
  app.use('/api/analytics', require('./routes/analyticsRoutes'))
  app.use('/api/audit', require('./routes/auditRoutes'))
  app.use('/api/templates', require('./routes/templateRoutes'))
  app.use('/api/slack', require('./routes/slackRoutes'))
  app.use('/api/projects', require('./routes/projectRoutes'))
  app.use('/api/timesheets', require('./routes/timesheetRoutes'))
  app.use('/api/support', require('./routes/supportRoutes'))
  app.use('/api/roles', require('./routes/roleRoutes'))
  app.use('/api/people', require('./routes/peopleRoutes'))

  // Health check — also keeps Render from sleeping
  app.get('/', (req, res) => res.send('StandupBot API ✅'))
  app.get('/health', (req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  )

  app.use((req, res) => res.status(404).json({ message: 'Not found' }))

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack)
    res.status(err.status || 500).json({
      message: err.message || 'Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  })

  return app
}

module.exports = { createApp, allowedOrigins }
