import axios from 'axios'
import { getUser } from '../store/authStore'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
})

// Har request mein token automatically lagao. Reading through authStore keeps
// the "Remember me" choice (localStorage vs sessionStorage) in one place.
API.interceptors.request.use((config) => {
  const user = getUser()
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`
  return config
})

export default API
