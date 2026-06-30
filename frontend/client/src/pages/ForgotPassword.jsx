import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await API.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success('Reset link sent! Check your inbox 📧')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-purple-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md">

        <h1 className="text-2xl font-bold text-purple-700 dark:text-purple-400 mb-1">
          🤖 StandupBot
        </h1>

        {!sent ? (
          <>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Enter your email and we'll send you a link to reset your password
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                  placeholder="you@company.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Reset Link →'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-4xl mb-4">📧</p>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Check your email
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              We've sent a password reset link to <strong>{email}</strong>.
              It will expire in 1 hour.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-purple-700 dark:text-purple-400 hover:underline"
            >
              Didn't get it? Try again
            </button>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Remember your password?{' '}
          <Link to="/login" className="text-purple-700 dark:text-purple-400 hover:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}