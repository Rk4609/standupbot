import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import API from '../api/axios'
import { IconAlert, IconShieldCheck } from '../components/ui/icons'
import { letterDate } from '../lib/letters'

/**
 * Public: somebody holding a printed letter checks it is real. Says only
 * what is already on the letter — never the body, never the salary.
 */
export default function VerifyLetter() {
  const { code } = useParams()
  const [result, setResult] = useState(null)

  useEffect(() => {
    let current = true
    API.get(`/letters/verify/${encodeURIComponent(code)}`)
      .then(res => current && setResult(res.data))
      .catch(err => current && setResult({ valid: false, message: err.response?.status === 404 ? 'No letter has this code.' : 'Could not check right now. Try again in a minute.' }))
    return () => { current = false }
  }, [code])

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card md:p-8">
        <p className="text-xs uppercase tracking-wide text-content-subtle">Letter verification · {code}</p>
        {!result ? (
          <p className="mt-4 text-sm text-content-muted">Checking…</p>
        ) : result.valid ? (
          <>
            <div className="mt-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <IconShieldCheck className="h-5 w-5" />
              <p className="font-semibold">This letter is genuine</p>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['Letter', result.title],
                ['Issued to', result.name],
                ['Issued by', result.company],
                ['Reference', result.number],
                ['Date', letterDate(result.issuedOn)]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-content-muted">{label}</dt>
                  <dd className="text-right font-medium text-content">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-content-subtle">Check that these match the printed letter. If anything differs, the letter has been altered.</p>
          </>
        ) : (
          <div className="mt-4 flex items-start gap-2 text-red-600 dark:text-red-400">
            <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-semibold">{result.message}</p>
          </div>
        )}
      </div>
    </main>
  )
}
