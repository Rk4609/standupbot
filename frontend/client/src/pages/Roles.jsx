import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { IconAlert, IconPlus, IconShieldCheck, IconTrash, IconUsers } from '../components/ui/icons'
import AssignRole from '../components/AssignRole'
import { cn } from '../lib/cn'
import { collapseVariants, DURATION, EASE } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const blank = { name: '', description: '', base: 'employee' }

const BASE_LABEL = {
  employee: 'Employee level',
  manager: 'Manager level',
  admin: 'Admin level'
}

const BASE_HINT = {
  employee: 'Sees their own work only. Nothing about anybody else.',
  manager: 'Can reach their own team — never another team.',
  admin: 'Everything, including who gets which role.'
}

/**
 * Who can open what.
 *
 * A role is a level plus a list. The level is what the server enforces on
 * every request — it is why a "Delivery lead" can never see another team's
 * data, whatever is ticked here. The list is what that role is given inside
 * those limits, which is the part worth editing: most of what a team argues
 * about is whether this person needs analytics, not whether they are a
 * manager.
 */
export default function Roles() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  const load = () =>
    API.get('/roles')
      .then(res => setData(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not load roles')))

  useEffect(() => {
    load()
  }, [])

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: role } = await API.post('/roles', {
        name: form.name.trim(),
        description: form.description.trim(),
        base: form.base
      })
      setForm(blank)
      setAdding(false)
      await load()
      setOpenId(role._id)
      toast.success(`${role.name} created`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not create that role'))
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Roles & access" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-52" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-96 rounded-card" />
      </PageShell>
    )
  }

  const groups = [...new Set(data.modules.map(m => m.group))]

  return (
    <PageShell>
      <PageHeader
        title="Roles & access"
        subtitle="What each role can open, and who holds it."
        actions={
          <Button onClick={() => setAdding(v => !v)} variant={adding ? 'ghost' : 'solid'}>
            {adding ? 'Cancel' : (
              <>
                <IconPlus className="h-4 w-4" />
                New role
              </>
            )}
          </Button>
        }
      />

      <AnimatePresence initial={false}>
        {adding && (
          <Card
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: DURATION.fast, ease: EASE }}
            className="mb-4"
          >
            <CardTitle>New role</CardTitle>
            <form onSubmit={create} className="space-y-4">
              <Field label="Name" hint="What people will call it. “Delivery lead”, “Contractor”.">
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Delivery lead"
                  maxLength={60}
                />
              </Field>

              <Field
                label="Level"
                hint={BASE_HINT[form.base]}
              >
                <Select
                  value={form.base}
                  onChange={e => setForm(f => ({ ...f, base: e.target.value }))}
                >
                  <option value="employee">Employee level</option>
                  <option value="manager">Manager level</option>
                  <option value="admin">Admin level</option>
                </Select>
              </Field>

              <Field label="What it is for" hint="Optional, but the next admin will thank you.">
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  maxLength={200}
                  placeholder="Runs a delivery squad. No access to pay or exports."
                />
              </Field>

              <Button type="submit" loading={saving} disabled={form.name.trim().length < 2}>
                Create role
              </Button>
            </form>
          </Card>
        )}
      </AnimatePresence>

      <Card padded={false}>
        <div className="px-5 py-4">
          <CardTitle className="mb-0">Roles</CardTitle>
          <p className="mt-1 text-xs text-content-subtle">
            Open one to change what it reaches, or to give it to somebody.
          </p>
        </div>

        <ul className="divide-y divide-line border-t border-line">
          {data.roles.map(role => (
            <RoleRow
              key={role._id}
              role={role}
              modules={data.modules}
              groups={groups}
              open={openId === role._id}
              onToggle={() => setOpenId(openId === role._id ? null : role._id)}
              onChanged={load}
            />
          ))}
        </ul>
      </Card>
    </PageShell>
  )
}

function RoleRow({ role, modules, groups, open, onToggle, onChanged }) {
  const [held, setHeld] = useState(role.modules)
  const [busy, setBusy] = useState(false)

  const allowed = new Set(role.allowed)
  const locked = role.key === 'admin'

  const toggle = async (key) => {
    const next = held.includes(key) ? held.filter(m => m !== key) : [...held, key]
    setHeld(next)
    setBusy(true)
    try {
      const { data } = await API.patch(`/roles/${role._id}`, { modules: next })
      setHeld(data.modules)
      onChanged?.()
    } catch (err) {
      setHeld(role.modules)
      toast.error(apiErrorMessage(err, 'Could not change that'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const { data } = await API.delete(`/roles/${role._id}`)
      toast.success(data.message)
      onChanged?.()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not remove that role'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-content">
            <IconShieldCheck className="h-4 w-4 text-content-subtle" />
            {role.name}
            {role.builtIn && <Badge tone="neutral">Built in</Badge>}
            <Badge tone={role.base === 'admin' ? 'danger' : role.base === 'manager' ? 'positive' : 'brand'}>
              {BASE_LABEL[role.base]}
            </Badge>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-content-subtle">
            <IconUsers className="h-3 w-3" />
            {role.people} {role.people === 1 ? 'person' : 'people'}
            <span aria-hidden="true">·</span>
            {held.length} of {role.allowed.length} modules
            {role.description ? ` · ${role.description}` : ''}
          </span>
        </button>

        {!role.builtIn && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label={`Remove the ${role.name} role`}
            className="shrink-0 rounded-md p-1.5 text-content-subtle transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-line bg-surface-sunken/40 px-5 py-4">
              {locked ? (
                <p className="rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-content-muted">
                  The Admin role keeps every module. It is the way back in when
                  somebody else&apos;s access is set wrong, so it cannot be narrowed.
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map(group => {
                    const inGroup = modules.filter(m => m.group === group)
                    if (inGroup.every(m => !allowed.has(m.key))) return null

                    return (
                      <div key={group}>
                        <p className="eyebrow mb-2">{group}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {inGroup.map(m => {
                            const reachable = allowed.has(m.key)
                            const on = held.includes(m.key)

                            return (
                              <label
                                key={m.key}
                                className={cn(
                                  'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                                  on
                                    ? 'border-brand-500/40 bg-brand-600/[0.06]'
                                    : 'border-line bg-surface',
                                  (!reachable || m.always || busy) && 'cursor-not-allowed opacity-55'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={!reachable || m.always || busy}
                                  onChange={() => toggle(m.key)}
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm text-content">{m.label}</span>
                                  {m.always && (
                                    <span className="block text-xs text-content-subtle">
                                      Everybody keeps this one
                                    </span>
                                  )}
                                  {!reachable && !m.always && (
                                    <span className="block text-xs text-content-subtle">
                                      Above this role&apos;s level
                                    </span>
                                  )}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <AssignRole role={role} onAssigned={onChanged} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
