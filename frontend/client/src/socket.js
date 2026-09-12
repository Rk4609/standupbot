import { io } from 'socket.io-client'
import { getUser } from './store/authStore'

const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
  autoConnect: false,
  // Callback form — har connect/reconnect pe fresh token bhejta hai
  auth: (cb) => cb({ token: getUser()?.token ?? null })
})

export default socket
