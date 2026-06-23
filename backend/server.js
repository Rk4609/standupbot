// const express = require('express')
// const dotenv = require('dotenv')
// const cors = require('cors')
// const connectDB = require('./config/db')

// dotenv.config()
// connectDB()

// const app = express()

// app.use(cors({
//   origin: '*', // development ke liye
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }))
// app.use(express.json())

// // Routes
// const authRoutes = require('./routes/authRoutes')
// const standupRoutes = require('./routes/standupRoutes')
// const teamRoutes = require('./routes/teamRoutes')
// const userRoutes = require('./routes/userRoutes')

// app.use('/api/auth', authRoutes)
// app.use('/api/standups', standupRoutes)
// app.use('/api/teams', teamRoutes)
// app.use('/api/users', userRoutes)

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('❌ Error:', err.stack)
//   res.status(500).json({
//     message: err.message || 'Server Error',
//     stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   })
// })

// app.get('/', (req, res) => res.send('StandupBot API ✅'))

// const { startCronJobs } = require('./services/cronService'); 


// // const PORT = process.env.PORT || 5000
// // app.listen(PORT, () => console.log(`Server running on port ${PORT} ✅`))

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT} ✅`);
//   startCronJobs();
// });

// console.log("EMAIL_USER =>", process.env.EMAIL_USER);
// console.log("EMAIL_PASS =>", process.env.EMAIL_PASS);


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

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// ✅ Socket.io global access ke liye
app.set('io', io)

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Socket.io events
io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`)

  // User apna room join kare (userId se)
  socket.on('join', (userId) => {
    socket.join(userId)
    console.log(`User ${userId} joined their room`)
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack)
  res.status(500).json({ message: err.message || 'Server Error' })
})

app.get('/', (req, res) => res.send('StandupBot API ✅'))

const { startCronJobs } = require('./services/cronService')

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`)
  startCronJobs()
})