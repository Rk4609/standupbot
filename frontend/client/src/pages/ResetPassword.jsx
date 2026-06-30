import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [verifying, setVerifying] = useState(true)
  const [valid, setValid] = useState(false)
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // ✅ Token verify karo page load pe
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const { data } = await API.get(`/auth/verify-reset-token/${token}`)
        setValid(data.valid)
        setEmail(data.email)
      } catch (err) {
        setValid(false)
      } finally {
        setVerifying(false)
      }
    }
    verifyToken()
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      return toast.error('Passwords do not match!')
    }
    if (password.length < 6) {
      return toast.error('Password min 6 characters hona chahiye')
    }

    setLoading(true)
    try {
      await API.put(`/auth/reset-password/${token}`, { password })
      setSuccess(true)
      toast.success('Password reset successfully! 🎉')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Loading state
  if (verifying) {
    return (
      <div className="min-h-screen bg-purple-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Verifying link...</p>
      </div>
    )
  }

  // ✅ Invalid/expired link
  if (!valid) {
    return (
      <div className="min-h-screen bg-purple-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Link Expired
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired.
            Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block bg-purple-700 dark:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 transition"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  // ✅ Success state
  if (success) {
    return (
      <div className="min-h-screen bg-purple-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md text-center">
          <p className="text-4xl mb-4">✅</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Password Reset!
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting you to login...
          </p>
        </div>
      </div>
    )
  }

  // ✅ Reset form
  return (
    <div className="min-h-screen bg-purple-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md">

        <h1 className="text-2xl font-bold text-purple-700 dark:text-purple-400 mb-1">
          🔒 Reset Password
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          Setting new password for <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
              placeholder="Min 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 transition ${
                confirmPassword && password !== confirmPassword
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-gray-200 dark:border-gray-600 focus:ring-purple-300 dark:focus:ring-purple-600'
              }`}
              placeholder="Repeat new password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match!</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (confirmPassword && password !== confirmPassword)}
            className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60"
          >
            {loading ? 'Resetting...' : 'Reset Password →'}
          </button>
        </form>

      </div>
    </div>
  )
}