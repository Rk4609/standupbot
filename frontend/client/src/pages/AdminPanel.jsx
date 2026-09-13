import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import Pagination from '../components/ui/Pagination'
import { Field, Input, Select } from '../components/ui/Field'
import { apiErrorMessage } from '../lib/apiError'
import { cn } from '../lib/cn'
import { IconSearch, IconUser, IconUsers } from '../components/ui/icons'

const loadAdminData = async () => {
  const [t, u, r] = await Promise.all([
    API.get('/teams'),
    API.get('/users'),
    // Named roles are what the bulk control hands out. An admin whose own
    // role does not include Roles & access simply does not get that control.
    API.get('/roles').catch(() => null)
  ])
  return { teams: t.data, users: u.data, roles: r?.data?.roles || [] }
}

const PAGE_SIZES = [10, 25, 50, 100]

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
  const [roles, setRoles] = useState([])

  // The user list: what is being looked for, and who is picked out of it
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [perPage, setPerPage] = useState(25)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState([])
  const [bulkRole, setBulkRole] = useState('')
  const [applying, setApplying] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' })
  const [memberForm, setMemberForm] = useState({ teamId: '', userId: '' })
  const [stats, setStats] = useState([])
  const [roleStats, setRoleStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)

  const apply = ({ teams: t, users: u, roles: r }) => {
    setTeams(t)
    setUsers(u)
    if (r) setRoles(r)
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

  const giveRole = async () => {
    const role = roles.find(r => r._id === bulkRole)
    if (!role || picked.length === 0) return

    setApplying(true)
    try {
      const { data } = await API.post(`/roles/${role._id}/assign`, { users: picked })
      toast.success(data.message)
      setPicked([])
      setBulkRole('')
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not move them'))
    } finally {
      setApplying(false)
    }
  }

  // Filtering happens here rather than on the server: this list is one
  // workspace's people, and a round trip per keystroke buys nothing
  const q = search.trim().toLowerCase()
  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (teamFilter !== 'all') {
      const teamId = u.team?._id || u.team
      if (teamFilter === 'none' ? Boolean(teamId) : String(teamId) !== teamFilter) return false
    }
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const shown = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const teamName = (u) => {
    const id = u.team?._id || u.team
    return u.team?.name || teams.find(t => String(t._id) === String(id))?.name || ''
  }

  const allShownPicked = shown.length > 0 && shown.every(u => picked.includes(u._id))

  if (loading) {
    return (
      <PageShell>
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
    <PageShell>
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
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <CardTitle className="mb-0">All users</CardTitle>
            <p className="mt-1 text-xs text-content-subtle">
              {filtered.length === users.length
                ? `${users.length} in the workspace`
                : `${filtered.length} of ${users.length} match`}
            </p>
          </div>
        </div>

        {/* Filters. The list used to be every account at once, which is a
            scroll nobody reads past the first screen of. */}
        <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3 md:px-6 lg:flex-row lg:items-center">
          <Input
            type="search"
            icon={IconSearch}
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="py-2 text-sm lg:flex-1"
          />
          <div className="flex flex-wrap gap-2.5">
            <div className="w-36">
              <Select
                value={roleFilter}
                onChange={e => {
                  setRoleFilter(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by role"
                className="py-2 text-sm"
              >
                <option value="all">All roles</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="w-40">
              <Select
                value={teamFilter}
                onChange={e => {
                  setTeamFilter(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by team"
                className="py-2 text-sm"
              >
                <option value="all">All teams</option>
                <option value="none">No team</option>
                {teams.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={perPage}
                onChange={e => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                aria-label="Rows per page"
                className="py-2 text-sm"
              >
                {PAGE_SIZES.map(n => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* What is picked, and what to do with it */}
        <AnimatePresence initial={false}>
          {picked.length > 0 && roles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-line bg-brand-600/[0.06]"
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
                <span className="text-sm font-medium text-content">
                  {picked.length} selected
                </span>
                <div className="w-52">
                  <Select
                    value={bulkRole}
                    onChange={e => setBulkRole(e.target.value)}
                    aria-label="Role to give them"
                    className="py-2 text-sm"
                  >
                    <option value="">Give them a role…</option>
                    {roles.map(r => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button onClick={giveRole} loading={applying} disabled={!bulkRole}>
                  Apply
                </Button>
                <button
                  type="button"
                  onClick={() => setPicked([])}
                  className="text-xs text-content-subtle underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {shown.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              icon={<IconUser className="h-6 w-6" />}
              title={users.length === 0 ? 'No users found' : 'Nobody matches that'}
              description={users.length === 0 ? undefined : 'Try a different search or filter.'}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-t border-line px-4 py-2 md:px-6">
              <input
                type="checkbox"
                checked={allShownPicked}
                onChange={() =>
                  setPicked(allShownPicked
                    ? picked.filter(id => !shown.some(u => u._id === id))
                    : [...new Set([...picked, ...shown.map(u => u._id)])])
                }
                aria-label="Select everybody on this page"
                className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs text-content-subtle">Select this page</span>
            </div>

            <ul className="divide-y divide-line border-t border-line">
              {shown.map(u => {
                const on = picked.includes(u._id)

                return (
                  <li
                    key={u._id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-6',
                      on && 'bg-brand-600/[0.06]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked(prev =>
                          prev.includes(u._id)
                            ? prev.filter(id => id !== u._id)
                            : [...prev, u._id])
                      }
                      aria-label={`Select ${u.name}`}
                      className="h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
                    />

                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-content">{u.name}</span>
                      <span className="block truncate text-xs text-content-subtle">
                        {u.email}
                        {teamName(u) ? ` · ${teamName(u)}` : ''}
                      </span>
                    </span>

                    {u._id === currentUserId ? (
                      <Badge tone={ROLE_TONE[u.role]} className="shrink-0 capitalize">
                        {u.role}
                      </Badge>
                    ) : (
                      // Select carries w-full in its base styles, so the width
                      // has to be constrained by a wrapper
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
                  </li>
                )
              })}
            </ul>

            {totalPages > 1 && (
              <div className="border-t border-line px-4 py-3 md:px-6">
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  total={filtered.length}
                  limit={perPage}
                  onPage={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

    </PageShell>
  )
}
