import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Card, { CardTitle } from './ui/Card'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { apiErrorMessage } from '../lib/apiError'
import { ago } from '../lib/kudos'

/** Where this account is signed in, with a way to end any of it. */
export default function SessionsCard() {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = () => API.get('/sessions').then(res => setData(res.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const end = async (session) => {
    setBusy(session._id)
    try {
      await API.delete(`/sessions/${session._id}`)
      toast.success(`Signed out on ${session.device}`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not sign that out'))
    } finally {
      setBusy(null)
    }
  }

  const endOthers = async () => {
    setBusy('others')
    try {
      const { data: res } = await API.post('/sessions/others', {})
      toast.success(res.message)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not sign those out'))
    } finally {
      setBusy(null)
    }
  }

  if (!data) return null
  const others = data.sessions.filter(s => !s.current)

  return (
    <Card>
      <CardTitle>Where you're signed in</CardTitle>
      {data.sessions.length === 0 ? (
        <p className="text-sm text-content-subtle">
          This sign-in is from before devices were listed. Sign out everywhere to start fresh.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {data.sessions.map(s => (
            <li key={s._id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm text-content">
                  {s.device}
                  {s.current && <Badge tone="positive">This device</Badge>}
                </p>
                <p className="text-xs text-content-subtle">
                  Active {ago(s.lastSeenAt)}{s.ip ? ` · ${s.ip}` : ''} · signed in {ago(s.createdAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="xs" variant="quiet-danger" loading={busy === s._id} onClick={() => end(s)}>
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(others.length > 0 || data.untracked) && (
        <Button size="sm" variant="outline" className="mt-4" loading={busy === 'others'} onClick={endOthers}>
          Sign out everywhere else
        </Button>
      )}
    </Card>
  )
}
