import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { saveUser } from '../store/authStore'

export default function Register({ setUser }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'member'
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await API.post('/auth/register', form)
      saveUser(data)
      setUser(data)
      toast.success(`Welcome aboard, ${data.name}! 🎉`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-purple-700 mb-1">🤖 StandupBot</h1>
        <p className="text-gray-500 text-sm mb-6">
          Create your account and get started
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Name</label>
            <input type="text" required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Work Email</label>
            <input type="email" required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input type="password" required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Select Role</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="member">Member — Submit daily standups</option>
              <option value="manager">Manager — View team progress</option>
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-purple-700 text-white py-2.5 rounded-lg font-medium hover:bg-purple-800 transition disabled:opacity-60">
            {loading ? 'Creating your account...' : 'Create Account →'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-purple-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}