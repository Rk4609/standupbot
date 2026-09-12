import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import { cn } from '../lib/cn'

// Capturing group keeps the delimiters, so split() returns the markers too
const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g

/** Render inline bold, italic and code runs inside a line. */
function inline(line, keyPrefix) {
  return line
    .split(INLINE)
    .filter(Boolean)
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`

      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return (
          <strong key={key} className="font-semibold text-content">
            {part.slice(2, -2)}
          </strong>
        )
      }
      if (/^\*[^*]+\*$/.test(part)) {
        return (
          <em key={key} className="italic">
            {part.slice(1, -1)}
          </em>
        )
      }
      if (/^`[^`]+`$/.test(part)) {
        return (
          <code
            key={key}
            className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part.slice(1, -1)}
          </code>
        )
      }
      return part
    })
}

/**
 * The models return lightweight markdown. Rendering it with a real markdown
 * library would mean shipping a parser and a sanitiser for four constructs, so
 * this handles exactly what the prompts ask for — headings, bullets, numbered
 * items and inline bold — and treats everything else as plain text.
 */
function formatReport(text) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim()

    if (trimmed === '') return <div key={i} className="h-2" />

    // Horizontal rule — the models emit these between sections
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      return <hr key={i} className="my-4 border-line" />
    }

    // Standalone heading: **Section title**
    if (/^\*\*.*\*\*$/.test(trimmed)) {
      return (
        <p
          key={i}
          className="mb-1.5 mt-5 text-sm font-bold text-content first:mt-0 md:text-base"
        >
          {trimmed.replace(/\*\*/g, '')}
        </p>
      )
    }

    if (/^[•\-*]\s/.test(trimmed)) {
      return (
        <p key={i} className="my-1 flex gap-2 pl-3 text-sm text-content-muted">
          <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
          <span>{inline(trimmed.slice(2), i)}</span>
        </p>
      )
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const [, num, rest] = trimmed.match(/^(\d+)\.\s(.*)$/)
      return (
        <p key={i} className="my-1 flex gap-2 pl-3 text-sm text-content-muted">
          <span className="tabular shrink-0 font-semibold text-brand-600 dark:text-brand-400">
            {num}.
          </span>
          <span>{inline(rest, i)}</span>
        </p>
      )
    }

    return (
      <p key={i} className="my-0.5 text-sm leading-relaxed text-content-muted">
        {inline(trimmed, i)}
      </p>
    )
  })
}

/**
 * Streaming AI output panel — shared by the team analysis and the weekly retro.
 */
export default function AiReport({
  title,
  text,
  loading,
  error,
  footnote,
  onClose,
  onRegenerate,
  onCopy,
  actions,
  className,
  scroll = true
}) {
  const bodyRef = useRef(null)
  const pinnedRef = useRef(true)

  // Follow the stream, but stop if the reader has scrolled up to read something
  const onScroll = () => {
    const el = bodyRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  useEffect(() => {
    if (!scroll || !loading || !pinnedRef.current) return
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text, loading, scroll])

  return (
    <div
      className={cn(
        'rounded-card border-2 border-brand-200 bg-surface p-4 shadow-card dark:border-brand-900 md:p-6',
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-xl">
            🧠
          </span>
          <span className="text-sm font-semibold text-content md:text-base">{title}</span>
          {loading && (
            <Badge tone="brand" className="animate-pulse">
              Generating…
            </Badge>
          )}
          {!loading && text && <Badge tone="positive">✅ Complete</Badge>}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close report"
            className="no-print -mr-1 -mt-1 rounded-lg p-1 text-lg leading-none text-content-subtle transition-colors hover:bg-surface-sunken hover:text-content"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
          <p className="text-sm text-red-600 dark:text-red-400">❌ {error}</p>
        </div>
      )}

      {loading && !text && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="mt-5 h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      )}

      {text && (
        <div
          ref={bodyRef}
          onScroll={onScroll}
          className={cn('scroll-slim pr-1', scroll && 'max-h-80 overflow-y-auto md:max-h-96')}
        >
          {formatReport(text)}
          {loading && (
            <motion.span
              aria-hidden="true"
              animate={{ opacity: [1, 0.15, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-sm bg-brand-500"
            />
          )}
        </div>
      )}

      {text && !loading && (onCopy || onRegenerate || footnote || actions) && (
        <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          {footnote && <p className="text-xs text-content-subtle">{footnote}</p>}
          <div className="ml-auto flex items-center gap-4">
            {actions}
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="text-xs text-content-muted transition-colors hover:text-brand-600 dark:hover:text-brand-400"
              >
                🔄 Regenerate
              </button>
            )}
            {onCopy && (
              <button
                onClick={onCopy}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                📋 Copy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
