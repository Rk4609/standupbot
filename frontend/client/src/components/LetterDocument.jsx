import { letterDate } from '../lib/letters'

/**
 * An issued letter on a page, to read on a phone and to print on A4.
 *
 * Everything on it came from the server at issue time; nothing is filled in
 * here, so the printout matches what the verification page confirms.
 */
export default function LetterDocument({ letter }) {
  const { company } = letter
  const verifyAt = `${window.location.origin}/verify/${letter.code}`

  return (
    <article className="print-plain rounded-card border border-line bg-surface p-6 shadow-card md:p-12">
      <header className="border-b border-line pb-5">
        <p className="text-xl font-semibold tracking-tight text-content">{company.name}</p>
        {company.address && <p className="mt-1 whitespace-pre-line text-xs text-content-muted">{company.address}</p>}
        {(company.email || company.phone) && (
          <p className="mt-0.5 text-xs text-content-muted">{[company.email, company.phone].filter(Boolean).join(' · ')}</p>
        )}
      </header>

      <div className="flex flex-wrap justify-between gap-2 py-5 text-sm text-content-muted">
        <span>Ref: {letter.number}</span>
        <span>{letterDate(letter.issuedOn)}</span>
      </div>

      <p className="text-sm font-medium text-content">{letter.addressedTo || 'To whomsoever it may concern'}</p>

      <h2 className="my-6 text-center text-base font-semibold uppercase tracking-wide text-content">{letter.title}</h2>

      <div className="space-y-4 text-[15px] leading-relaxed text-content">
        {letter.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </div>

      <div className="mt-14">
        <p className="text-sm text-content">For {company.name}</p>
        <div className="mt-12 w-56 border-t border-line pt-2">
          <p className="text-sm font-medium text-content">{company.signatory || letter.issuedByName}</p>
          <p className="text-xs text-content-muted">{company.signatoryTitle}</p>
        </div>
      </div>

      <footer className="mt-12 border-t border-line pt-3 text-[11px] leading-relaxed text-content-subtle">
        Verify this letter at {verifyAt} — code {letter.code}
      </footer>
    </article>
  )
}
