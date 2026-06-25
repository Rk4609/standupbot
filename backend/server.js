const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const connectDB = require('./config/db')

dotenv.config()
connectDB()

const app = express()
const server = http.createServer(app)

// ✅ Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL
].filter(Boolean)

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// ✅ Socket.io global access
app.set('io', io)

// ✅ CORS — production ready
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.use(express.json())

// Routes
const authRoutes = require('./routes/authRoutes')
const standupRoutes = require('./routes/standupRoutes')
const teamRoutes = require('./routes/teamRoutes')
const userRoutes = require('./routes/userRoutes')
const notificationRoutes = require('./routes/notificationRoutes')

app.use('/api/auth', authRoutes)
app.use('/api/standups', standupRoutes)
app.use('/api/teams', teamRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
const aiRoutes = require('./routes/aiRoutes')
app.use('/api/ai', aiRoutes)

// ✅ Socket.io events
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`)

  socket.on('join', (userId) => {
    socket.join(userId)
    console.log(`User ${userId} joined their room`)
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

// ✅ Health check — Render sleep se bachne ke liye
app.get('/', (req, res) => res.send('StandupBot API ✅'))
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString()
}))

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack)
  res.status(500).json({
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

const { startCronJobs } = require('./services/cronService')

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
  startCronJobs()
})