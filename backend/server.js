const dotenv = require('dotenv')
const http = require('http')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')

dotenv.config()

const connectDB = require('./config/db')
const { createApp, allowedOrigins } = require('./app')
const { startCronJobs } = require('./services/cronService')

connectDB()

const app = createApp()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: allowedOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Controllers reach the hub through req.app.get('io')
app.set('io', io)

// ✅ Socket.io auth — handshake mein JWT verify karo
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Authentication required'))

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.id
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`)

  // ✅ Sirf apne hi room mein join — client se userId nahi lete
  socket.join(socket.userId)
  console.log(`User ${socket.userId} joined their room`)

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Allowed origins: ${allowedOrigins().join(', ')}`)
  startCronJobs()
})
