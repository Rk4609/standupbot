import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Card, { CardTitle } from './ui/Card'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Field, Input } from './ui/Field'
import { apiErrorMessage } from '../lib/apiError'

/** "Two-step sign-in" on the profile: turn on with an authenticator app, or off. */
export default function TwoFactorSettings() {
  const [status, setStatus] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState(null)
  const [disabling, setDisabling] = useState(false)
  const [off, setOff] = useState({ password: '', code: '' })
  const [busy, setBusy] = useState(false)

  const load = () => API.get('/auth/2fa').then(res => setStatus(res.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const start = async () => {
    setBusy(true)
    try {
      const { data } = await API.post('/auth/2fa/setup', {})
      setSetup(data)
      setCode('')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start that'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await API.post('/auth/2fa/enable', { code })
      setSetup(null)
      setCodes(data.recoveryCodes)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'That code did not work'))
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await API.post('/auth/2fa/disable', off)
      toast.success('Two-step sign-in is off')
      setDisabling(false)
      setOff({ password: '', code: '' })
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not turn that off'))
    } finally {
      setBusy(false)
    }
  }

  const copyCodes = () =>
    navigator.clipboard?.writeText(codes.join('\n')).then(() => toast.success('Codes copied')).catch(() => {})

  if (!status) return null

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle className="mb-0">Two-step sign-in</CardTitle>
        {status.enabled ? <Badge tone="positive">On</Badge> : status.required ? <Badge tone="warning">Needed</Badge> : <Badge>Off</Badge>}
      </div>
      <p className="text-sm text-content-muted">
        {status.enabled
          ? `After your password, a code from your authenticator app. ${status.recoveryLeft} recovery ${status.recoveryLeft === 1 ? 'code' : 'codes'} left.`
          : status.required
            ? 'Your role can see sensitive data, so your account needs a code from your phone as well as your password.'
            : 'Ask for a code from your phone as well as your password when you sign in.'}
      </p>
      {status.enabled
        ? <Button size="sm" variant="quiet-danger" className="mt-4" onClick={() => setDisabling(true)}>Turn off</Button>
        : <Button size="sm" className="mt-4" loading={busy} onClick={start}>Turn on</Button>}

      <AnimatePresence>
        {setup && (
          <Modal title="Turn on two-step sign-in" subtitle="Use Google Authenticator, Microsoft Authenticator or similar." onClose={() => setSetup(null)}>
            <form onSubmit={confirm} className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-content-muted">
                <li>Scan this with your authenticator app.</li>
                <li>Type the six-digit code it shows.</li>
              </ol>
              <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
              <p className="break-all text-center text-xs text-content-subtle">
                Can’t scan? Enter this key: <span className="font-mono text-content">{setup.secret}</span>
              </p>
              <Field label="Code from the app">
                <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} placeholder="123 456" />
              </Field>
              <Button type="submit" full loading={busy} disabled={code.replace(/\s/g, '').length !== 6}>Turn on</Button>
            </form>
          </Modal>
        )}

        {codes && (
          <Modal title="Save your recovery codes" subtitle="Each works once if you lose your phone. They will not be shown again." onClose={() => setCodes(null)}>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface-sunken p-4 font-mono text-sm text-content">
              {codes.map(c => <li key={c}>{c}</li>)}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={copyCodes}>Copy</Button>
              <Button onClick={() => setCodes(null)}>I have saved them</Button>
            </div>
          </Modal>
        )}

        {disabling && (
          <Modal title="Turn off two-step sign-in" onClose={() => setDisabling(false)}>
            <form onSubmit={turnOff} className="space-y-4">
              <Field label="Password">
                <Input type="password" autoComplete="current-password" value={off.password} onChange={e => setOff(o => ({ ...o, password: e.target.value }))} />
              </Field>
              <Field label="Code from the app, or a recovery code">
                <Input autoComplete="one-time-code" value={off.code} onChange={e => setOff(o => ({ ...o, code: e.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDisabling(false)}>Keep it on</Button>
                <Button type="submit" variant="danger" loading={busy} disabled={!off.password || off.code.trim().length < 6}>Turn off</Button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </Card>
  )
}
