import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import Skeleton from '../components/ui/Skeleton'

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

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const { data } = await API.get(`/auth/verify-reset-token/${token}`)
        setValid(data.valid)
        setEmail(data.email)
      } catch {
        setValid(false)
      } finally {
        setVerifying(false)
      }
    }
    verifyToken()
  }, [token])

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const tooShort = password.length > 0 && password.length < 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mismatch || tooShort) return

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

  if (verifying) {
    return (
      <AuthLayout title="Verifying your link" subtitle="One moment…">
        <div className="space-y-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </AuthLayout>
    )
  }

  if (!valid) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password reset link is invalid or has already been used."
      >
        <Button to="/forgot-password" size="lg" full>
          Request a new link
        </Button>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout title="Password reset" subtitle="Redirecting you to sign in…">
        <div className="text-center">
          <motion.div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-950"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            ✅
          </motion.div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={`Resetting the password for ${email}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="New password"
          error={tooShort ? 'Password must be at least 6 characters' : ''}
        >
          <Input
            type="password"
            required
            autoComplete="new-password"
            invalid={tooShort}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </Field>

        <Field
          label="Confirm new password"
          error={mismatch ? 'Passwords do not match' : ''}
        >
          <Input
            type="password"
            required
            autoComplete="new-password"
            invalid={mismatch}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          full
          loading={loading}
          disabled={mismatch || tooShort}
        >
          {loading ? 'Resetting...' : 'Reset password →'}
        </Button>
      </form>
    </AuthLayout>
  )
}
