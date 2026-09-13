import axios from 'axios'
import { getUser, removeUser } from '../store/authStore'

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

/**
 * Signing in is the one place a 401 is an answer rather than an expiry.
 *
 * Wrong password, unknown email, a reset link that has lapsed — those come
 * back 401 and the form should say so, not throw the person out of a session
 * they are not in yet.
 */
const ANSWERS_WITH_401 = ['/auth/login', '/auth/register', '/auth/reset-password']

const isSignIn = (url = '') => ANSWERS_WITH_401.some(path => url.includes(path))

/**
 * A token lasts seven days. When it lapses every page started failing in its
 * own way — one showed empty fields, another said "user no longer exists" —
 * because each handled its own 401 and none of them knew what it meant.
 *
 * It means the session is over, and that is not a page-level fact. The stored
 * session is cleared here and the browser goes to sign-in with a reason, once,
 * however many requests happen to fail at the same moment.
 */
let signingOut = false

API.interceptors.response.use(
  response => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''

    if (status === 401 && !isSignIn(url) && !signingOut) {
      signingOut = true
      removeUser()

      // A full load rather than a router navigation: everything in memory
      // belongs to the session that just ended
      const target = '/login?expired=1'
      if (window.location.pathname !== '/login') {
        window.location.replace(target)
      } else {
        signingOut = false
      }
    }

    return Promise.reject(error)
  }
)

export default API
