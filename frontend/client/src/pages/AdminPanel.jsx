import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { Field, Input, Select } from '../components/ui/Field'
import { apiErrorMessage } from '../lib/apiError'
import { IconUser, IconUsers } from '../components/ui/icons'

const loadAdminData = async () => {
  const [t, u] = await Promise.all([API.get('/teams'), API.get('/users')])
  return { teams: t.data, users: u.data }
}

const ROLE_COLORS = ['#ef4444', '#10b981', '#7c3aed']
const ROLE_TONE = { admin: 'danger', manager: 'positive', employee: 'brand' }

const chartTooltip = {
  backgroundColor: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--line))',
  borderRadius: '10px',
  color: 'rgb(var(--content))',
  fontSize: '12px',
  boxShadow: '0 12px 32px -8px rgb(0 0 0 / 0.18)'
}

export default function AdminPanel({ user }) {
  const currentUserId = user?._id
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' })
  const [memberForm, setMemberForm] = useState({ teamId: '', userId: '' })
  const [stats, setStats] = useState([])
  const [roleStats, setRoleStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)

  const apply = ({ teams: t, users: u }) => {
    setTeams(t)
    setUsers(u)
    setRoleStats(
      ['admin', 'manager', 'employee'].map(role => ({
        name: role.charAt(0).toUpperCase() + role.slice(1),
        value: u.filter(user => user.role === role).length
      }))
    )
    setStats(t.map(team => ({ name: team.name, members: team.members?.length || 0 })))
  }

  useEffect(() => {
    let cancelled = false

    loadAdminData()
      .then(data => {
        if (!cancelled) apply(data)
      })
      .catch(err => {
        console.error(err)
        if (!cancelled) toast.error(apiErrorMessage(err, 'Could not load admin data'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refresh = async () => {
    try {
      apply(await loadAdminData())
    } catch (err) {
      console.error(err)
      toast.error(apiErrorMessage(err, 'Could not refresh'))
    }
  }


  const createTeam = async () => {
    if (!teamForm.name.trim()) return toast.error('Please enter a team name')
    setCreating(true)
    try {
      await API.post('/teams', teamForm)
      toast.success('Team created')
      setTeamForm({ name: '', managerId: '' })
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Something went wrong'))
    } finally {
      setCreating(false)
    }
  }

  const addMember = async () => {
    if (!memberForm.teamId || !memberForm.userId) {
      return toast.error('Select both a team and an employee')
    }
    setAdding(true)
    try {
      await API.post(`/teams/${memberForm.teamId}/members`, { userId: memberForm.userId })
      toast.success('Employee added')
      setMemberForm({ teamId: '', userId: '' })
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Something went wrong'))
    } finally {
      setAdding(false)
    }
  }

  const changeRole = async (user, role) => {
    // Optimistic: the select should not snap back while the request is in
    // flight, and a failure re-reads the server's truth anyway.
    setUsers(prev => prev.map(u => (u._id === user._id ? { ...u, role } : u)))
    try {
      const { data } = await API.patch(`/users/${user._id}/role`, { role })
      toast.success(data.message)
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not change role'))
      refresh()
    }
  }

  const managers = users.filter(u => u.role === 'manager')
  const employees = users.filter(u => u.role === 'employee')

  if (loading) {
    return (
      <PageShell width="xl">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell width="xl">
      <PageHeader title="Admin panel" subtitle="Teams, employees and role distribution" />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard value={users.length} label="Total users" tone="brand" />
        <StatCard value={teams.length} label="Total teams" tone="positive" />
        <StatCard value={employees.length} label="Employees" tone="warning" />
      </div>

      {/* Charts */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Employees per team</CardTitle>
          {stats.length === 0 ? (
            <p className="py-12 text-center text-sm text-content-subtle">No teams yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'rgb(var(--content-subtle))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'rgb(var(--content-subtle))' }}
                  width={30}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-sunken))' }} contentStyle={chartTooltip} />
                <Bar dataKey="members" fill="#7c3aed" radius={[6, 6, 0, 0]} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardTitle>Role distribution</CardTitle>
          {roleStats.every(r => r.value === 0) ? (
            <p className="py-12 text-center text-sm text-content-subtle">No users yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={roleStats}
                  cx="50%"
                  cy="45%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={700}
                >
                  {roleStats.map((entry, i) => (
                    <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltip} />
                <Legend
                  formatter={value => (
                    <span style={{ color: 'rgb(var(--content-muted))', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Forms */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Create a team</CardTitle>
          <div className="space-y-3">
            <Field label="Team name">
              <Input
                type="text"
                placeholder="e.g. Platform"
                value={teamForm.name}
                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
              />
            </Field>
            <Field
              label="Manager"
              hint={managers.length === 0 ? 'No managers registered yet' : undefined}
            >
              <Select
                value={teamForm.managerId}
                onChange={e => setTeamForm({ ...teamForm, managerId: e.target.value })}
              >
                <option value="">Select a manager</option>
                {managers.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
            </Field>
            <Button full loading={creating} onClick={createTeam}>
              Create team
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Add an employee to a team</CardTitle>
          <div className="space-y-3">
            <Field label="Team">
              <Select
                value={memberForm.teamId}
                onChange={e => setMemberForm({ ...memberForm, teamId: e.target.value })}
              >
                <option value="">Select a team</option>
                {teams.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employee">
              <Select
                value={memberForm.userId}
                onChange={e => setMemberForm({ ...memberForm, userId: e.target.value })}
              >
                <option value="">Select an employee</option>
                {employees.map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
            </Field>
            <Button full variant="primary" loading={adding} onClick={addMember}>
              Add employee
            </Button>
          </div>
        </Card>
      </div>

      {/* Teams */}
      <Card className="mb-4">
        <CardTitle>All teams</CardTitle>
        {teams.length === 0 ? (
          <EmptyState
            icon={<IconUsers className="h-6 w-6" />}
            title="No teams yet"
            description="Create your first team above."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <div className="space-y-3">
            {teams.map((t, i) => (
              <motion.div
                key={t._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.05 }}
                className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-3 sm:flex-row sm:items-center sm:justify-between md:p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content">{t.name}</p>
                  <p className="mt-0.5 text-xs text-content-subtle">
                    Manager: {t.manager?.name || 'Not assigned'} · {t.members?.length || 0} employees
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.members?.slice(0, 3).map(m => (
                    <Badge key={m._id} tone="brand">
                      {m.name}
                    </Badge>
                  ))}
                  {t.members?.length > 3 && (
                    <span className="self-center text-xs text-content-subtle">
                      +{t.members.length - 3} more
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Users */}
      <Card>
        <CardTitle>All users</CardTitle>
        {users.length === 0 ? (
          <EmptyState
            icon={<IconUser className="h-6 w-6" />}
            title="No users found"
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <div className="divide-y divide-line">
            {users.map((u, i) => (
              <motion.div
                key={u._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(0.05 + i * 0.03, 0.4) }}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{u.name}</p>
                    <p className="truncate text-xs text-content-subtle">{u.email}</p>
                  </div>
                </div>
                {u._id === currentUserId ? (
                  <Badge tone={ROLE_TONE[u.role]} className="capitalize">
                    {u.role}
                  </Badge>
                ) : (
                  // Select carries w-full in its base styles, so the width has
                  // to be constrained by a wrapper — a w-32 on the control
                  // itself loses to w-full and the dropdown pushes the name and
                  // email out of the row.
                  <div className="w-32 shrink-0">
                    <Select
                      value={u.role}
                      onChange={e => changeRole(u, e.target.value)}
                      aria-label={`Role for ${u.name}`}
                      className="py-1.5 text-xs"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  )
}
