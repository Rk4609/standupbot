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
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select } from '../components/ui/Field'
import Modal from '../components/ui/Modal'
import PushSettings from '../components/PushSettings'
import TwoFactorSettings from '../components/TwoFactorSettings'
import SessionsCard from '../components/SessionsCard'
import { cn } from '../lib/cn'
import { SPRING, itemVariants, listVariants } from '../lib/motion'
import {
  IconAlert,
  IconCamera,
  IconCheck,
  IconClock,
  IconFlame,
  IconHourglass,
  IconLock,
  IconPencil
} from '../components/ui/icons'
import {
  detectTimezone,
  lastNDatesForUser,
  offsetLabel,
  timeIn,
  timezoneOptions
} from '../lib/timezone'
import { apiErrorMessage } from '../lib/apiError'
import { prettyDate } from '../lib/dates'

const ROLE_TONE = { admin: 'danger', manager: 'positive', employee: 'brand' }

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** A stored date names a calendar day, so read it in UTC and not locally. */
const dayOf = (iso) => new Date(`${iso}T00:00:00.000Z`).getUTCDay()
const isWeekend = (iso) => dayOf(iso) === 0 || dayOf(iso) === 6

const monthYear = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

/** Read-only facts belong in a description list, not in inputs nobody can type in. */
function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-xs text-content-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-content">{children}</dd>
    </div>
  )
}

/** One day in the week strip. */
function Day({ date, submitted, today }) {
  const weekend = isWeekend(date)

  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1.5">
      <div
        title={`${date}${submitted ? ' · submitted' : weekend ? '' : ' · nothing submitted'}`}
        className={cn(
          'flex h-9 w-full items-center justify-center rounded-lg border transition-colors',
          submitted
            ? 'border-brand-400 bg-brand-400 text-brand-700 dark:border-brand-400 dark:bg-brand-400'
            : weekend
              ? 'border-transparent bg-surface-sunken/60'
              : 'border-line bg-surface-sunken',
          today && !submitted && 'border-brand-400'
        )}
      >
        {submitted ? (
          <IconCheck className="h-4 w-4" />
        ) : (
          // A weekend with nothing in it is not a gap, so it says nothing
          <span
            aria-hidden="true"
            className={cn(
              'h-1 w-1 rounded-full',
              weekend ? 'bg-content-subtle/30' : 'bg-content-subtle/70'
            )}
          />
        )}
      </div>
      <span
        className={cn(
          'text-[11px]',
          today ? 'font-semibold text-content' : 'text-content-subtle'
        )}
      >
        {WEEKDAY[dayOf(date)]}
      </span>
    </div>
  )
}

/** Numbers that describe the person, not the page. */
function Metric({ icon: Icon, value, label, tone = 'brand' }) {
  const tones = {
    brand: 'text-brand-600 dark:text-brand-400',
    positive: 'text-emerald-600 dark:text-emerald-400',
    neutral: 'text-content'
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-content-muted">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={cn('tabular text-lg font-bold leading-none', tones[tone])}>{value}</p>
        <p className="mt-1 truncate text-xs text-content-subtle">{label}</p>
      </div>
    </div>
  )
}

const EMPLOYMENT_LABEL = {
  intern: 'Intern',
  probation: 'On probation',
  'full-time': 'Full time',
  contract: 'Contract'
}

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [nameForm, setNameForm] = useState({ name: '', timezone: '' })

  // Built once: the browser knows several hundred zones
  const [zones] = useState(timezoneOptions)
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [nameLoading, setNameLoading] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  // Which dialog is open, if any. The forms used to sit in a tabbed card
  // that took two thirds of the page for something people touch twice a
  // year — the record underneath is what they actually came to read.
  const [dialog, setDialog] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await API.get('/users/profile')
        setProfile(data)
        setNameForm({ name: data.name, timezone: data.timezone || '' })
      } catch (err) {
        // Rendering the shell with every field empty looks like an account
        // with no details rather than a page that failed to load
        setLoadError(apiErrorMessage(err, 'Could not load your profile'))
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
      toast.error(apiErrorMessage(err, 'Upload failed'))
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
      const updatedUser = { ...user, name: data.name, timezone: data.timezone }
      saveUser(updatedUser)
      setUser(updatedUser)
      setProfile(prev => ({ ...prev, name: data.name, timezone: data.timezone }))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Update failed'))
    } finally {
      setNameLoading(false)
    }
  }

  const passMismatch =
    passForm.confirmPassword.length > 0 && passForm.newPassword !== passForm.confirmPassword
  const passTooShort = passForm.newPassword.length > 0 && passForm.newPassword.length < 6
  const passReady =
    passForm.currentPassword.length > 0 &&
    passForm.newPassword.length >= 6 &&
    passForm.newPassword === passForm.confirmPassword

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!passReady) return

    setPassLoading(true)
    try {
      await API.put('/users/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      toast.success('Password changed')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Password change failed'))
    } finally {
      setPassLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-44" />
        <Skeleton className="mb-7 h-4 w-72" />
        <Skeleton className="mb-4 h-40 rounded-card" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-card lg:col-span-2" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell>
        <PageHeader title="My profile" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={loadError} />
      </PageShell>
    )
  }

  const days = lastNDatesForUser(7)
  const today = days[days.length - 1]
  const submitted = days.filter(d => profile.submittedDates?.includes(d))

  const job = profile.employment || {}
  const address = [
    profile.address?.line1,
    profile.address?.city,
    profile.address?.state,
    profile.address?.pincode
  ].filter(Boolean).join(', ')
  // Counted against working days only, or a Saturday standup would read as
  // one of five weekdays covered
  const onWorkingDays = submitted.filter(d => !isWeekend(d)).length
  const workingDays = days.filter(d => !isWeekend(d)).length
  const extra = submitted.length - onWorkingDays

  const zone = nameForm.timezone
  const detected = detectTimezone()
  const changed =
    nameForm.name.trim() !== (profile.name || '') ||
    (nameForm.timezone || '') !== (profile.timezone || '')
  const nameEmpty = nameForm.name.trim() === ''

  return (
    <PageShell>
      <PageHeader
        title="My profile"
        subtitle="Your details, and how the app counts your days."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDialog('profile')}>
              <IconPencil className="h-4 w-4" />
              Edit profile
            </Button>
            <button
              type="button"
              onClick={() => setDialog('password')}
              aria-label="Change your password"
              title="Change your password"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-content-muted transition-colors hover:text-content"
            >
              <IconLock className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <motion.div variants={listVariants} initial="initial" animate="animate">
        {/* Identity */}
        <motion.div variants={itemVariants}>
          <Card className="mb-4">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="group relative shrink-0 self-center sm:self-start">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-1 ring-line"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600/10 text-2xl font-bold text-brand-700 ring-1 ring-line dark:text-brand-300">
                    {profile.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <motion.button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarLoading}
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING}
                  aria-label="Change your picture"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                >
                  {avatarLoading ? (
                    <IconHourglass className="h-5 w-5" />
                  ) : (
                    <IconCamera className="h-5 w-5" />
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

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h2 className="truncate text-title font-semibold text-content">
                  {profile.name}
                </h2>
                <p className="mt-0.5 truncate text-sm text-content-muted">{profile.email}</p>

                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge tone={ROLE_TONE[profile.role]} className="capitalize">
                    {profile.role}
                  </Badge>
                  {profile.team && <Badge tone="neutral">{profile.team.name}</Badge>}
                  <Badge tone="neutral">
                    <IconClock className="h-3 w-3" />
                    {zone ? `${timeIn(zone)} local` : 'UTC'}
                  </Badge>
                </div>
              </div>

              {/* The two numbers that say how this person is doing */}
              <div className="flex justify-center gap-8 border-t border-line pt-4 sm:justify-end sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                <Metric
                  icon={IconFlame}
                  value={profile.streak || 0}
                  label="day streak"
                />
                <Metric
                  icon={IconCheck}
                  value={profile.totalStandups || 0}
                  label="standups"
                  tone="positive"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="eyebrow">This week</p>
                <p className="tabular text-xs text-content-subtle">
                  {onWorkingDays} of {workingDays} working days
                  {extra > 0 && ` · ${extra} at the weekend`}
                </p>
              </div>

              <div className="flex gap-1.5">
                {days.map(date => (
                  <Day
                    key={date}
                    date={date}
                    submitted={profile.submittedDates?.includes(date)}
                    today={date === today}
                  />
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {/* What is actually worth reading here: the record, wide enough to
              sit in two columns rather than squeezed beside a form nobody
              opens twice */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card>
              <CardTitle>Your record</CardTitle>

              {job.position || profile.phone || profile.dob ? (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  {job.position && <Fact label="Position">{job.position}</Fact>}
                  {job.employeeId && <Fact label="Employee ID">{job.employeeId}</Fact>}
                  <Fact label="Kind of hire">
                    {EMPLOYMENT_LABEL[job.type] || 'Full time'}
                  </Fact>
                  {job.joinedOn && <Fact label="Joined">{prettyDate(job.joinedOn)}</Fact>}
                  {job.endsOn && (
                    <Fact label={job.type === 'intern' ? 'Internship ends' : 'Probation ends'}>
                      {prettyDate(job.endsOn)}
                    </Fact>
                  )}
                  {job.experienceYears > 0 && (
                    <Fact label="Experience before this">{job.experienceYears} years</Fact>
                  )}
                  {profile.phone && <Fact label="Phone">{profile.phone}</Fact>}
                  {profile.dob && <Fact label="Date of birth">{prettyDate(profile.dob)}</Fact>}
                  {address && (
                    <Fact label="Address">
                      <span className="block whitespace-normal text-right">{address}</span>
                    </Fact>
                  )}
                  {profile.salary?.amount && (
                    <Fact label="Salary">
                      {profile.salary.currency} {Number(profile.salary.amount).toLocaleString()}
                      {profile.salary.period === 'month' ? ' / month' : ' / year'}
                    </Fact>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-content-muted">
                  Nothing has been filled in yet. An admin keeps this part.
                </p>
              )}

              <Button to="/support" variant="outline" className="mt-4">
                Ask for a correction
              </Button>
            </Card>
          </motion.div>

          {/* Set by somebody else, and shorter, so it takes the side column */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardTitle>Account</CardTitle>
              <dl className="divide-y divide-line">
                <Fact label="Email">{profile.email}</Fact>
                <Fact label="Role">
                  <span className="capitalize">{profile.roleName || profile.role}</span>
                </Fact>
                <Fact label="Team">{profile.team?.name || 'Not on a team'}</Fact>
                <Fact label="Member since">{monthYear(profile.createdAt)}</Fact>
              </dl>
              <p className="mt-3 text-xs text-content-subtle">
                Your email and role are set by an admin.
              </p>
            </Card>
            <div className="mt-4">
              <TwoFactorSettings />
            </div>
            <div className="mt-4">
              <PushSettings />
            </div>
            <div className="mt-4">
              <SessionsCard />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence>
        {dialog === 'profile' && (
          <Modal
            title="Edit profile"
            subtitle="Your name, and the clock your standups are filed against."
            onClose={() => setDialog(null)}
          >
            <form onSubmit={handleNameUpdate} className="space-y-5">
              <Field
                label="Full name"
                error={nameEmpty ? 'Your name cannot be empty' : ''}
              >
                <Input
                  type="text"
                  value={nameForm.name}
                  invalid={nameEmpty}
                  onChange={e => setNameForm(f => ({ ...f, name: e.target.value }))}
                />
              </Field>

              <div>
                <Field
                  label="Timezone"
                  hint={
                    zone
                      ? `Your standups are filed against this clock — it is ${timeIn(zone)} there now.`
                      : 'Not set, so your standups are filed against UTC.'
                  }
                >
                  <Select
                    value={nameForm.timezone}
                    onChange={e => setNameForm(f => ({ ...f, timezone: e.target.value }))}
                  >
                    <option value="">Not set (UTC)</option>
                    {zones.map(tz => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')} · {offsetLabel(tz)}
                      </option>
                    ))}
                  </Select>
                </Field>

                {detected && detected !== nameForm.timezone && (
                  <button
                    type="button"
                    onClick={() => setNameForm(f => ({ ...f, timezone: detected }))}
                    className="mt-2 text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                  >
                    Use this device&apos;s zone ({detected.replace(/_/g, ' ')})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button type="submit" loading={nameLoading} disabled={!changed || nameEmpty}>
                  Save changes
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <p className="text-xs text-content-subtle">
                  {changed ? 'You have unsaved changes.' : 'Nothing to save.'}
                </p>
              </div>
            </form>
          </Modal>
        )}

        {dialog === 'password' && (
          <Modal
            title="Change password"
            subtitle="You stay signed in on this device."
            onClose={() => setDialog(null)}
          >
            <form onSubmit={handlePasswordChange} className="space-y-5">
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
                error={passTooShort ? 'Use at least 6 characters' : ''}
                hint={passTooShort ? '' : 'At least 6 characters.'}
              >
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  invalid={passTooShort}
                  value={passForm.newPassword}
                  onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                />
              </Field>

              <Field
                label="Confirm new password"
                error={passMismatch ? 'These do not match' : ''}
              >
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  invalid={passMismatch}
                  value={passForm.confirmPassword}
                  onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <Button type="submit" loading={passLoading} disabled={!passReady}>
                  Change password
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}
