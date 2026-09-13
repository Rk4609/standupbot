import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import { Input } from './ui/Field'
import { IconSearch, IconUsers } from './ui/icons'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'

/**
 * Give this role to the people you pick.
 *
 * A search box and checkboxes rather than one dropdown per person: moving a
 * squad onto a new role is the normal case, and doing that one row at a time
 * is how half of them end up on the wrong one.
 */
export default function AssignRole({ role, onAssigned }) {
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    API.get('/users')
      .then(res => {
        if (!cancelled) setPeople(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load the list of people'))
      })

    return () => {
      cancelled = true
    }
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = people || []
    if (!q) return list.slice(0, 50)
    return list
      .filter(p => `${p.name} ${p.email}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [people, query])

  const toggle = (id) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const give = async () => {
    setBusy(true)
    try {
      const { data } = await API.post(`/roles/${role._id}/assign`, { users: picked })
      toast.success(data.message)
      setPicked([])
      onAssigned?.()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not move them'))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <p className="text-xs text-content-subtle">{error}</p>
  }

  return (
    <div>
      <p className="eyebrow mb-2">Give this role to</p>

      <div className="mb-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          icon={IconSearch}
          placeholder="Search by name or email"
          aria-label={`Find somebody to give ${role.name} to`}
          className="py-2 text-sm"
        />
      </div>

      {!people ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <ul className="scroll-slim max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
          {matches.length === 0 ? (
            <li className="px-3.5 py-6 text-center text-sm text-content-subtle">
              Nobody matches “{query}”
            </li>
          ) : (
            matches.map(person => {
              const on = picked.includes(person._id)

              return (
                <li key={person._id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors',
                      on ? 'bg-brand-600/[0.06]' : 'hover:bg-surface-sunken'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(person._id)}
                      className="h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-content">{person.name}</span>
                      <span className="block truncate text-xs text-content-subtle">
                        {person.email}
                      </span>
                    </span>
                    <Badge tone="neutral" className="shrink-0 capitalize">
                      {person.role}
                    </Badge>
                  </label>
                </li>
              )
            })
          )}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={give} loading={busy} disabled={picked.length === 0}>
          <IconUsers className="h-4 w-4" />
          Give {role.name} to {picked.length || 'nobody'}
          {picked.length > 0 && (picked.length === 1 ? ' person' : ' people')}
        </Button>

        {picked.length > 0 && (
          <button
            type="button"
            onClick={() => setPicked([])}
            className="text-xs text-content-subtle underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}

        <p className="text-xs text-content-subtle">
          This also sets their level to {role.base} — that is the half the server enforces.
        </p>
      </div>
    </div>
  )
}
