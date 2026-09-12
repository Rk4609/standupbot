import BlockerBadge from './BlockerBadge'
import Card from './ui/Card'
import Badge from './ui/Badge'
import { MOOD_EMOJI, MOOD_TONE } from '../lib/moods'

function Section({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-subtle">
        {label}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-content-muted">
        {children}
      </p>
    </div>
  )
}

export default function StandupCard({ standup, showUser = false }) {
  const { user, yesterday, today, blockers, hasBlocker, mood, date } = standup

  return (
    <Card interactive className="p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {showUser && user && (
            <div className="mr-1 flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content">{user.name}</p>
                {user.streak > 0 && (
                  <p className="text-xs text-content-subtle">🔥 {user.streak} day streak</p>
                )}
              </div>
            </div>
          )}

          <Badge tone={MOOD_TONE[mood]}>
            <span aria-hidden="true">{MOOD_EMOJI[mood]}</span>
            <span className="capitalize">{mood}</span>
          </Badge>

          {hasBlocker && <BlockerBadge compact />}
        </div>

        <span className="tabular shrink-0 text-xs font-medium text-content-subtle">{date}</span>
      </div>

      <div className="space-y-3">
        <Section label="Accomplished yesterday">{yesterday}</Section>
        <Section label="Today's plan">{today}</Section>
        {hasBlocker && <BlockerBadge text={blockers} />}
      </div>
    </Card>
  )
}
