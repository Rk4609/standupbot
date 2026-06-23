import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

// Har request mein token automatically lagao
API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('standupbot_user') || '{}')
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`
  return config
})

export default API