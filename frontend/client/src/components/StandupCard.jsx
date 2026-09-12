import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BlockerBadge from './BlockerBadge'
import StandupHistory from './StandupHistory'
import Card from './ui/Card'
import Badge from './ui/Badge'
import { MOOD_EMOJI, MOOD_TONE } from '../lib/moods'
import { collapseVariants } from '../lib/motion'
import { IconFlame, IconPencil } from './ui/icons'

/**
 * Mongoose stamps both timestamps on create, so a standup that was never
 * touched has them within a tick of each other. A second of slack is enough
 * to tell "saved once" from "edited later" without reading the audit trail
 * for every card in a list.
 */
const wasEdited = (standup) =>
  standup.updatedAt &&
  standup.createdAt &&
  new Date(standup.updatedAt) - new Date(standup.createdAt) > 1000

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

/** Last resort when the question that produced an answer is no longer asked. */
const humanise = (key) =>
  key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

export default function StandupCard({
  standup,
  showUser = false,
  onEdit,
  // key -> the team's own wording, from the active template
  questionLabels = {}
}) {
  const { user, yesterday, today, blockers, hasBlocker, mood, date } = standup
  const extras = Object.entries(standup.answers || {}).filter(([, v]) => v)
  const [showHistory, setShowHistory] = useState(false)
  const edited = wasEdited(standup)

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
                  <p className="flex items-center gap-1 text-xs text-content-subtle">
                    <IconFlame className="h-3 w-3" />
                    {user.streak} day streak
                  </p>
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

        <div className="flex shrink-0 items-center gap-2">
          {edited && (
            <button
              type="button"
              onClick={() => setShowHistory(v => !v)}
              aria-expanded={showHistory}
              className="rounded-md px-1.5 py-0.5 text-xs text-content-subtle underline-offset-2 transition-colors hover:text-content hover:underline"
            >
              Edited
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(standup)}
              aria-label={`Edit standup for ${date}`}
              className="rounded-md p-1 text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
            >
              <IconPencil className="h-4 w-4" />
            </button>
          )}
          <span className="tabular text-xs font-medium text-content-subtle">{date}</span>
        </div>
      </div>

      <div className="space-y-3">
        {yesterday && (
          <Section label={questionLabels.yesterday || 'Accomplished yesterday'}>
            {yesterday}
          </Section>
        )}
        <Section label={questionLabels.today || "Today's plan"}>{today}</Section>

        {/* A team's own questions, in whatever words they asked them */}
        {extras.map(([key, value]) => (
          <Section key={key} label={questionLabels[key] || humanise(key)}>
            {value}
          </Section>
        ))}

        {hasBlocker && <BlockerBadge text={blockers} />}
      </div>

      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-line pt-4">
              <StandupHistory standupId={standup._id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
