import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Card, { CardTitle } from './ui/Card'
import Button from './ui/Button'
import { cn } from '../lib/cn'
import { apiErrorMessage } from '../lib/apiError'
import { currentSubscription, disablePush, enablePush, pushSupport } from '../lib/push'

/**
 * "Notifications on this device", on the profile.
 *
 * One switch per browser or phone. Says plainly why it cannot be turned on
 * when it cannot — not set up on the server, blocked in the browser, or an
 * iPhone that has to add the app to the home screen first.
 */
export default function PushSettings() {
  const [server, setServer] = useState(null)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const support = pushSupport()

  useEffect(() => {
    let current = true
    API.get('/push')
      .then(res => current && setServer(res.data))
      .catch(() => current && setServer({ enabled: false, devices: [] }))
    currentSubscription()
      .then(sub => current && setOn(Boolean(sub)))
      .catch(() => {})
    return () => { current = false }
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) {
        await disablePush()
        setOn(false)
        toast.success('Notifications are off for this device')
      } else {
        await enablePush(server.publicKey)
        setOn(true)
        toast.success('Notifications are on for this device')
      }
      const { data } = await API.get('/push')
      setServer(data)
    } catch (err) {
      toast.error(err.response ? apiErrorMessage(err, 'That did not work') : err.message)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const { data } = await API.post('/push/test', {})
      toast.success(data.message)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send a test'))
    } finally {
      setBusy(false)
    }
  }

  let note = null
  if (server && !server.enabled) note = 'Phone notifications are not set up on this server yet. An admin needs to add the keys.'
  else if (support === 'install-first') note = 'On an iPhone, add StandupBot to your home screen first (Share → Add to Home Screen), then turn this on from there.'
  else if (support === 'blocked') note = 'Notifications are blocked for this site. Allow them in your browser settings, then come back.'
  else if (support === 'unsupported') note = 'This browser cannot show notifications while the app is closed.'

  const available = server?.enabled && support === 'supported'
  const otherDevices = (server?.devices?.length || 0) - (on ? 1 : 0)

  return (
    <Card>
      <CardTitle>Notifications on this device</CardTitle>

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-content-muted">
          Leave decisions, payslips, replies to your requests and your morning brief — even when StandupBot is closed.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Notifications on this device"
          disabled={!available || busy || !server}
          onClick={toggle}
          className={cn(
            'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
            on ? 'bg-brand-600 dark:bg-brand-400' : 'bg-surface-sunken ring-1 ring-inset ring-line'
          )}
        >
          <span
            className={cn(
              'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
              on ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {note && <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{note}</p>}

      {on && (
        <Button size="sm" variant="outline" className="mt-4" loading={busy} onClick={test}>
          Send a test
        </Button>
      )}

      {otherDevices > 0 && (
        <p className="mt-3 text-xs text-content-subtle">
          Also on for {otherDevices} other {otherDevices === 1 ? 'device' : 'devices'}.
        </p>
      )}
    </Card>
  )
}
