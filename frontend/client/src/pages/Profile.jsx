import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import { saveUser } from '../store/authStore'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Skeleton from '../components/ui/Skeleton'
import { Field, Input } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING } from '../lib/motion'
import { IconCamera, IconHourglass, IconLock, IconPencil } from '../components/ui/icons'

const ROLE_TONE = { admin: 'danger', manager: 'positive', employee: 'brand' }

const last7Days = () => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nameForm, setNameForm] = useState({ name: '' })
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [nameLoading, setNameLoading] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const fileRef = useRef(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await API.get('/users/profile')
        setProfile(data)
        setNameForm({ name: data.name })
      } catch (err) {
        console.error(err)
        toast.error('Could not load your profile')
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB')

    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const { data } = await API.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const updatedUser = { ...user, avatar: data.avatar }
      saveUser(updatedUser)
      setUser(updatedUser)
      setProfile(prev => ({ ...prev, avatar: data.avatar }))
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setAvatarLoading(false)
      e.target.value = ''
    }
  }

  const handleNameUpdate = async (e) => {
    e.preventDefault()
    setNameLoading(true)
    try {
      const { data } = await API.put('/users/profile', nameForm)
      const updatedUser = { ...user, name: data.name }
      saveUser(updatedUser)
      setUser(updatedUser)
      setProfile(prev => ({ ...prev, name: data.name }))
      toast.success('Name updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setNameLoading(false)
    }
  }

  const passMismatch =
    passForm.confirmPassword.length > 0 && passForm.newPassword !== passForm.confirmPassword
  const passTooShort = passForm.newPassword.length > 0 && passForm.newPassword.length < 6

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passMismatch || passTooShort) return

    setPassLoading(true)
    try {
      await API.put('/users/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      toast.success('Password changed')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed')
    } finally {
      setPassLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell width="sm">
        <Skeleton className="mb-6 h-8 w-40" />
        <Card className="mb-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-52" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </Card>
        <Skeleton className="h-48 rounded-card" />
      </PageShell>
    )
  }

  const days = last7Days()
  const today = days[days.length - 1]

  return (
    <PageShell width="sm">
      <PageHeader title="My profile" />

      <Card className="mb-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative shrink-0">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="h-24 w-24 rounded-full border-4 border-brand-100 object-cover dark:border-brand-900"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand-100 bg-brand-50 text-3xl font-bold text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
            )}

            <motion.button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              whileTap={{ scale: 0.9 }}
              transition={SPRING}
              title="Change avatar"
              aria-label="Change avatar"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm text-white shadow-brand transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {avatarLoading ? (
                <IconHourglass className="h-3.5 w-3.5" />
              ) : (
                <IconCamera className="h-3.5 w-3.5" />
              )}
            </motion.button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="truncate text-xl font-bold text-content">{profile?.name}</h2>
            <p className="mt-0.5 truncate text-sm text-content-muted">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge tone={ROLE_TONE[profile?.role]} className="capitalize">
                {profile?.role}
              </Badge>
              {profile?.team && <Badge tone="neutral">Team: {profile.team.name}</Badge>}
            </div>
            <p className="mt-2 text-xs text-content-subtle">
              Member since{' '}
              {new Date(profile?.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          <StatCard
            value={profile?.streak || 0}
            label="Day streak"
            tone="brand"
            className="border-0 bg-transparent p-0 shadow-none"
          />
          <StatCard
            value={profile?.totalStandups || 0}
            label="Total standups"
            tone="positive"
            className="border-0 bg-transparent p-0 shadow-none"
          />
          <StatCard
            value={profile?.submittedDates?.length || 0}
            suffix="/7"
            label="This week"
            tone="warning"
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>

        {/* Activity strip */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-content-subtle">
            Last 7 days
          </p>
          <div className="flex justify-between gap-2">
            {days.map((day, i) => {
              const submitted = profile?.submittedDates?.includes(day)
              const isToday = day === today
              return (
                <div key={day} className="flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 + i * 0.05, ...SPRING }}
                    title={day}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold',
                      submitted
                        ? 'bg-brand-500 text-white shadow-brand dark:bg-brand-600'
                        : 'bg-surface-sunken text-content-subtle',
                      isToday && 'ring-2 ring-brand-400 ring-offset-2'
                    )}
                    style={isToday ? { '--tw-ring-offset-color': 'rgb(var(--surface))' } : undefined}
                  >
                    {submitted ? '✓' : '–'}
                  </motion.div>
                  <span className="text-xs text-content-subtle">
                    {new Date(day).toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <motion.div className="mb-4 flex gap-2">
        {[
          { id: 'profile', label: 'Edit profile', icon: IconPencil },
          { id: 'password', label: 'Change password', icon: IconLock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id ? 'text-white' : 'text-content-muted hover:text-content'
            )}
          >
            {activeTab === tab.id && (
              <motion.span
                layoutId="profile-tab"
                transition={SPRING}
                className="absolute inset-0 rounded-xl bg-brand-600 shadow-brand"
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DURATION.fast, ease: EASE }}
        >
          {activeTab === 'profile' ? (
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <CardTitle>Edit profile</CardTitle>
              <form onSubmit={handleNameUpdate} className="space-y-4">
                <Field label="Full name">
                  <Input
                    type="text"
                    required
                    value={nameForm.name}
                    onChange={e => setNameForm({ name: e.target.value })}
                  />
                </Field>
                <Field label="Email" hint="Email cannot be changed.">
                  <Input type="email" disabled value={profile?.email || ''} />
                </Field>
                <Field label="Role">
                  <Input type="text" disabled value={profile?.role || ''} className="capitalize" />
                </Field>
                <Button type="submit" full loading={nameLoading}>
                  {nameLoading ? 'Saving…' : 'Save changes'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <CardTitle>Change password</CardTitle>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <Field label="Current password">
                  <Input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passForm.currentPassword}
                    onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </Field>
                <Field
                  label="New password"
                  error={passTooShort ? 'Password must be at least 6 characters' : ''}
                >
                  <Input
                    type="password"
                    required
                    autoComplete="new-password"
                    invalid={passTooShort}
                    value={passForm.newPassword}
                    onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                    placeholder="At least 6 characters"
                  />
                </Field>
                <Field
                  label="Confirm new password"
                  error={passMismatch ? 'Passwords do not match' : ''}
                >
                  <Input
                    type="password"
                    required
                    autoComplete="new-password"
                    invalid={passMismatch}
                    value={passForm.confirmPassword}
                    onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                    placeholder="Repeat new password"
                  />
                </Field>
                <Button
                  type="submit"
                  full
                  loading={passLoading}
                  disabled={passMismatch || passTooShort}
                >
                  {passLoading ? 'Changing…' : 'Change password'}
                </Button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  )
}
