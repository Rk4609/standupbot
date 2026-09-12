import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { saveUser } from '../store/authStore'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import PasswordToggle from '../components/ui/PasswordToggle'
import { IconLock, IconMail, IconUser } from '../components/ui/icons'

export default function Register({ setUser }) {
  // No role field: everyone registers as an employee and an admin grants
  // manager or admin afterwards. Letting the client pick meant anyone could
  // sign themselves up as a manager.
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [reveal, setReveal] = useState(false)
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
      subtitle="Two minutes a day keeps the whole team aligned."
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
            icon={IconUser}
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
            icon={IconMail}
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
            type={reveal ? 'text' : 'password'}
            required
            autoComplete="new-password"
            icon={IconLock}
            invalid={passwordTooShort}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="At least 6 characters"
            trailing={
              <PasswordToggle revealed={reveal} onToggle={() => setReveal(v => !v)} />
            }
          />
        </Field>

        <p className="text-xs text-content-subtle">
          You will join as an employee. An admin can make you a manager afterwards.
        </p>

        <Button
          type="submit"
          size="lg"
          full
          loading={loading}
          disabled={passwordTooShort}
          className="!mt-6"
        >
          {loading ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
