import { io } from 'socket.io-client'

const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
  autoConnect: false,
  // Callback form — har connect/reconnect pe fresh token bhejta hai
  auth: (cb) => {
    try {
      const user = JSON.parse(localStorage.getItem('standupbot_user') || '{}')
      cb({ token: user?.token })
    } catch {
      cb({ token: null })
    }
  }
})

export default socket
