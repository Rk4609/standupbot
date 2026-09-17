import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api/axios'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { DURATION, EASE } from '../lib/motion'
import { navGroups } from '../lib/navigation'
import { KEYWORDS, rank } from '../lib/commandSearch'
import {
  IconBriefcase, IconCalendar, IconClock, IconInbox, IconMoon, IconSearch, IconSun, IconUser, IconUsers
} from './ui/icons'

/** An icon for each kind of thing the search can find. */
const RESULT_ICON = {
  people: IconUser,
  projects: IconBriefcase,
  tickets: IconInbox,
  leave: IconCalendar,
  standups: IconClock,
  candidates: IconUsers
}

/** Wait this long after the last key before asking the server. */
const SEARCH_DELAY_MS = 200

const RECENT_KEY = 'palette-recent'
const RECENT_LIMIT = 5

/** Pages opened from here before, newest first. A convenience, so it may be missing. */
const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const remember = (to) => {
  try {
    const list = [to, ...readRecent().filter(x => x !== to)].slice(0, RECENT_LIMIT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Private window or blocked storage: the palette works without history
  }
}

const IconSignOut = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7" />
  </svg>
)

/**
 * Ctrl+K (⌘K on a Mac): type a few letters, press Enter, be there.
 *
 * Lists the pages this person can open — the same list the menus use, so it
 * never offers a page their role would refuse — plus a few things worth
 * doing from anywhere. Arrow keys move, Enter opens, Escape closes.
 */
export default function CommandPalette({ open, onClose, user, dark, onToggleTheme, onLogout }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // What the server found, with the words it was found for, so an answer
  // to an older query is never shown under a newer one
  const [found, setFound] = useState({ q: '', groups: [] })

  const items = useMemo(() => {
    const pages = navGroups(user).flatMap(group =>
      group.items.map(item => ({
        id: item.to,
        kind: 'page',
        to: item.to,
        label: item.label,
        group: group.label || 'Me',
        icon: item.icon,
        keywords: KEYWORDS[item.to] || []
      }))
    )

    return [
      ...pages,
      { id: '/profile', kind: 'page', to: '/profile', label: 'Profile', group: 'Me', icon: IconUser, keywords: KEYWORDS['/profile'] },
      {
        id: 'theme',
        kind: 'action',
        label: dark ? 'Switch to light mode' : 'Switch to dark mode',
        group: 'Action',
        icon: dark ? IconSun : IconMoon,
        keywords: ['theme', 'dark', 'light', 'night'],
        run: onToggleTheme
      },
      {
        id: 'logout',
        kind: 'action',
        label: 'Sign out',
        group: 'Action',
        icon: IconSignOut,
        keywords: ['log out', 'logout', 'exit'],
        run: onLogout
      }
    ]
  }, [user, dark, onToggleTheme, onLogout])

  // Reset when it opens rather than when it closes, so the closing animation
  // does not flash an empty list
  const [openedAt, setOpenedAt] = useState(open)
  if (open !== openedAt) {
    setOpenedAt(open)
    if (open) {
      setQuery('')
      setActive(0)
    }
  }

  const term = query.trim()
  const searching = term.length >= 2 && found.q !== term

  useEffect(() => {
    if (!open || term.length < 2) return undefined
    let current = true
    const timer = setTimeout(() => {
      API.get('/search', { params: { q: term } })
        .then(res => current && setFound({ q: term, groups: res.data.groups || [] }))
        .catch(() => current && setFound({ q: term, groups: [] }))
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [term, open])

  const results = useMemo(() => {
    if (term) {
      const pages = rank(items, term, found.q === term && found.groups.length ? 5 : 9)
      const records = found.q === term
        ? found.groups.flatMap(g => g.results.map(r => ({
          id: `${g.key}:${r.id}`,
          kind: 'result',
          to: r.to,
          label: r.title,
          detail: r.detail,
          group: g.label,
          icon: RESULT_ICON[g.key]
        })))
        : []
      return [...pages, ...records]
    }
    const byId = new Map(items.map(i => [i.id, i]))
    const recent = readRecent().map(id => byId.get(id)).filter(Boolean)
    const rest = items.filter(i => i.kind === 'page' && !recent.includes(i)).slice(0, 8 - recent.length)
    return [...recent.map(i => ({ ...i, recent: true })), ...rest]
    // readRecent is read again each time the palette opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, term, found, openedAt])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Keep the highlighted row in view as the arrows move it
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const choose = (item) => {
    if (!item) return
    onClose()
    if (item.kind === 'page') {
      remember(item.id)
      navigate(item.to)
    } else if (item.kind === 'result') {
      navigate(item.to)
    } else {
      item.run?.()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast }}
          className="no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Go to"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: DURATION.base, ease: EASE }}
            className="w-full max-w-lg overflow-hidden rounded-card border border-line bg-surface-raised shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <IconSearch className="h-4 w-4 shrink-0 text-content-subtle" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                placeholder="Search pages, people, projects…"
                aria-label="Search pages and actions"
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
                className="h-14 w-full bg-transparent text-[15px] text-content placeholder:text-content-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-content-subtle sm:block">
                Esc
              </kbd>
            </div>

            <ul
              id="palette-results"
              ref={listRef}
              role="listbox"
              className="scroll-slim max-h-[min(24rem,60vh)] overflow-y-auto p-1.5"
            >
              {results.length === 0 && !searching && (
                <li className="px-3 py-8 text-center text-sm text-content-subtle">
                  Nothing called “{query}”.
                </li>
              )}
              {results.map((item, i) => {
                const Icon = item.icon
                return (
                  <li
                    key={item.id}
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm',
                      i === active ? 'bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300' : 'text-content'
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.detail && (
                        <span className="block truncate text-xs text-content-subtle">{item.detail}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-content-subtle">
                      {item.recent ? 'Recent' : item.group}
                    </span>
                  </li>
                )
              })}
              {searching && (
                <li className="px-3 py-2.5 text-xs text-content-subtle" aria-live="polite">
                  Searching people, projects and requests…
                </li>
              )}
            </ul>

            <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-content-subtle sm:flex">
              <span><kbd className="font-sans">↑↓</kbd> move</span>
              <span><kbd className="font-sans">Enter</kbd> open</span>
              <span className="ml-auto">
                <kbd className="font-sans">{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd> anywhere
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
