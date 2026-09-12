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
import { Checkbox, Field, Input, Select } from '../components/ui/Field'
import { IconAlert, IconCheck, IconBell } from '../components/ui/icons'
import { collapseVariants } from '../lib/motion'
import { apiErrorMessage } from '../lib/apiError'

const EVENTS = [
  {
    key: 'standupSubmitted',
    label: 'Each standup as it is posted',
    hint: 'One message per person per day. Noisy for a big team.'
  },
  {
    key: 'blockerRaised',
    label: 'Blockers, the moment they appear',
    hint: 'Posted separately so it is not buried inside a standup.'
  },
  {
    key: 'dailySummary',
    label: 'The end-of-day digest',
    hint: 'Who posted, who is blocked — at 6pm in your timezone.'
  },
  {
    key: 'weeklyRetro',
    label: 'The weekly retro',
    hint: 'The generated retrospective, every Friday evening.'
  }
]

const when = (iso) => {
  if (!iso) return 'never'
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function Integrations() {
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [channel, setChannel] = useState('')
  const [busy, setBusy] = useState('')

  // An admin can wire up any team, so every call has to say which one. A
  // manager has one team and the server picks it.
  const [team, setTeam] = useState(null)

  useEffect(() => {
    let cancelled = false

    API.get('/slack', { params: team ? { team } : {} })
      .then(res => {
        if (cancelled) return
        setState(res.data)
        setTeam(res.data.team || null)
        setLoadError('')
      })
      .catch(err => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your integrations'))
      })

    return () => {
      cancelled = true
    }
  }, [team])

  /** Every mutation names the team, so an admin edits the one they are looking at. */
  const withTeam = (body = {}) => (team ? { ...body, team } : body)

  const connect = async (e) => {
    e.preventDefault()
    setBusy('connect')
    try {
      const { data } = await API.put('/slack', withTeam({
        webhookUrl: webhookUrl.trim(),
        channel: channel.trim()
      }))
      setState(data)
      setWebhookUrl('')
      toast.success(data.message || 'Connected')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not connect to Slack'))
    } finally {
      setBusy('')
    }
  }

  const toggle = async (key, value) => {
    // Show the switch moving straight away, and put it back if the save fails
    const previous = state.events
    setState(s => ({ ...s, events: { ...s.events, [key]: value } }))

    try {
      const { data } = await API.patch('/slack', withTeam({ events: { [key]: value } }))
      setState(data)
    } catch (err) {
      setState(s => ({ ...s, events: previous }))
      toast.error(apiErrorMessage(err, 'Could not save that'))
    }
  }

  const sendTest = async () => {
    setBusy('test')
    try {
      const { data } = await API.post('/slack/test', withTeam())
      toast.success(data.message || 'Sent')
      const refreshed = await API.get('/slack', { params: withTeam() })
      setState(refreshed.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Slack did not accept that'))
      const refreshed = await API.get('/slack', { params: withTeam() }).catch(() => null)
      if (refreshed) setState(refreshed.data)
    } finally {
      setBusy('')
    }
  }

  const disconnect = async () => {
    setBusy('disconnect')
    try {
      const { data } = await API.delete('/slack', { params: withTeam() })
      setState(data)
      toast.success('Disconnected')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not disconnect'))
    } finally {
      setBusy('')
    }
  }

  if (loadError) {
    return (
      <PageShell className="max-w-3xl">
        <PageHeader title="Integrations" />
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={loadError} />
      </PageShell>
    )
  }

  if (!state) {
    return (
      <PageShell className="max-w-3xl">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-7 h-4 w-80" />
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        title="Integrations"
        subtitle="Send standups, blockers and the weekly retro to a Slack channel."
        actions={
          state.teams?.length > 1 && (
            <div className="w-52">
              <Select
                value={team || ''}
                onChange={e => {
                  setState(null)
                  setTeam(e.target.value)
                }}
                aria-label="Team"
                className="py-2 text-sm"
              >
                {state.teams.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CardTitle className="mb-0">Slack</CardTitle>
            {state.connected ? (
              <Badge tone="positive">
                <IconCheck className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge tone="neutral">Not connected</Badge>
            )}
          </div>

          {state.connected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={sendTest}
                loading={busy === 'test'}
                disabled={Boolean(busy)}
              >
                Send a test
              </Button>
              <Button
                variant="ghost"
                onClick={disconnect}
                loading={busy === 'disconnect'}
                disabled={Boolean(busy)}
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>

        {state.connected ? (
          <>
            <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-content-subtle">Channel</dt>
                <dd className="mt-0.5 text-content">{state.channel || 'not named'}</dd>
              </div>
              <div>
                <dt className="text-xs text-content-subtle">Webhook</dt>
                <dd className="mt-0.5 truncate text-content-muted" title={state.webhook}>
                  {state.webhook}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-content-subtle">Last delivery</dt>
                <dd className="mt-0.5 text-content-muted">{when(state.lastDeliveryAt)}</dd>
              </div>
            </dl>

            <AnimatePresence initial={false}>
              {state.lastError && (
                <motion.div
                  variants={collapseVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="overflow-hidden"
                >
                  <div className="mb-5 flex gap-2.5 rounded-xl border-l-2 border-red-500/70 bg-red-500/[0.055] py-2.5 pl-3.5 pr-4">
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content">
                        The last message did not get through
                      </p>
                      <p className="mt-0.5 break-words text-xs text-content-muted">
                        {state.lastError}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mb-3 text-sm font-medium text-content-muted">What to post</p>
            <div className="space-y-3.5">
              {EVENTS.map(e => (
                <div key={e.key}>
                  <Checkbox
                    label={e.label}
                    checked={Boolean(state.events?.[e.key])}
                    onChange={ev => toggle(e.key, ev.target.checked)}
                  />
                  <p className="ml-7 mt-0.5 text-xs text-content-subtle">{e.hint}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 rounded-xl border border-line bg-surface-sunken px-4 py-3.5">
              <p className="text-sm font-medium text-content">How to get a webhook</p>
              <ol className="mt-2 space-y-1 text-xs text-content-muted">
                <li>
                  1. In Slack, open <span className="text-content">Apps → Incoming Webhooks</span>{' '}
                  and add it to your workspace.
                </li>
                <li>2. Choose the channel these updates should land in.</li>
                <li>3. Copy the webhook URL Slack gives you and paste it below.</li>
              </ol>
            </div>

            <form onSubmit={connect} className="space-y-4">
              <Field
                label="Webhook URL"
                hint="Anyone with this URL can post to the channel. It is never shown again in full after saving."
              >
                <Input
                  type="url"
                  required
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  autoComplete="off"
                />
              </Field>

              <Field label="Channel name" hint="Just a label, so you can tell which channel this is.">
                <Input
                  value={channel}
                  onChange={e => setChannel(e.target.value)}
                  placeholder="#standups"
                  maxLength={80}
                />
              </Field>

              <Button
                type="submit"
                full
                loading={busy === 'connect'}
                disabled={!webhookUrl.trim()}
              >
                <IconBell className="h-4 w-4" />
                Connect and send a test message
              </Button>

              <p className="text-center text-xs text-content-subtle">
                Nothing is saved until Slack accepts the webhook.
              </p>
            </form>
          </>
        )}
      </Card>
    </PageShell>
  )
}
