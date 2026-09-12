import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import AuthLayout from '../components/AuthLayout'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { DURATION, EASE } from '../lib/motion'

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
    <AuthLayout
      title={sent ? 'Check your email' : 'Forgot your password?'}
      subtitle={
        sent
          ? undefined
          : "Enter your email and we'll send you a link to reset it"
      }
      footer={
        <>
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="space-y-4"
          >
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </Field>

            <Button type="submit" size="lg" full loading={loading}>
              {loading ? 'Sending...' : 'Send reset link →'}
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="text-center"
          >
            <motion.p
              aria-hidden="true"
              className="mb-4 text-4xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.1 }}
            >
              📧
            </motion.p>
            <p className="text-sm text-content-muted">
              If <strong className="text-content">{email}</strong> is registered, a reset
              link is on its way. It expires in 1 hour.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-5"
              onClick={() => setSent(false)}
            >
              Didn&apos;t get it? Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  )
}
