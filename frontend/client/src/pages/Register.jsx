import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { saveUser } from '../store/authStore'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/ui/Button'
import { Field, Input, Select } from '../components/ui/Field'

export default function Register({ setUser }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'member'
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const passwordTooShort = form.password.length > 0 && form.password.length < 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (passwordTooShort) return
    setLoading(true)
    try {
      const { data } = await API.post('/auth/register', form)
      saveUser(data)
      setUser(data)
      toast.success(`Welcome aboard, ${data.name}`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Two minutes a day keeps your team aligned"
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <Input
            type="text"
            required
            autoComplete="name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Rakesh Jangid"
          />
        </Field>

        <Field label="Work email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>

        <Field
          label="Password"
          error={passwordTooShort ? 'Password must be at least 6 characters' : ''}
        >
          <Input
            type="password"
            required
            autoComplete="new-password"
            invalid={passwordTooShort}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="At least 6 characters"
          />
        </Field>

        <Field label="Role">
          <Select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            <option value="member">Member — submit daily standups</option>
            <option value="manager">Manager — view team progress</option>
          </Select>
        </Field>

        <Button type="submit" size="lg" full loading={loading} disabled={passwordTooShort}>
          {loading ? 'Creating your account...' : 'Create account →'}
        </Button>
      </form>
    </AuthLayout>
  )
}
