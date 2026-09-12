import { useEffect, useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'
import EditStandupDialog from '../components/EditStandupDialog'
import { todayForUser } from '../lib/timezone'
import { MOOD_EMOJI } from '../lib/moods'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { DURATION, EASE, SPRING, collapseVariants, itemVariants } from '../lib/motion'
import { IconFilter, IconInbox, IconSearch } from '../components/ui/icons'

const MOODS = ['all', 'great', 'good', 'okay', 'bad', 'stressed']
const MOOD_ICON = MOOD_EMOJI

const BLOCKER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'blocker', label: 'Has blocker' },
  { value: 'no-blocker', label: 'No blocker' }
]

function Chip({ active, onClick, children, className }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={SPRING}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line bg-surface-sunken text-content-muted hover:border-brand-300 hover:text-content',
        className
      )}
    >
      {children}
    </motion.button>
  )
}

function FilterTag({ tone = 'brand', onClear, children }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
    danger: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
  }
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={SPRING}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone]
      )}
    >
      {children}
      <button
        onClick={onClear}
        aria-label="Remove filter"
        className="opacity-60 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </motion.span>
  )
}

export default function History() {
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState('all')
  const [blockerFilter, setBlockerFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [editing, setEditing] = useState(null)

  // The team's own wording for each question, so a card labels an answer the
  // way it was asked rather than by its key
  const [questionLabels, setQuestionLabels] = useState({})

  useEffect(() => {
    let cancelled = false
    API.get('/templates/active')
      .then(res => {
        if (cancelled) return
        setQuestionLabels(
          Object.fromEntries(res.data.questions.map(q => [q.key, q.label]))
        )
      })
      .catch(() => {
        // Falling back to the default labels is fine — the answers still show
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await API.get('/standups/my')
        setStandups(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const filtered = useMemo(() => {
    return standups.filter(s => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          s.yesterday?.toLowerCase().includes(q) ||
          s.today?.toLowerCase().includes(q) ||
          s.blockers?.toLowerCase().includes(q) ||
          s.date?.includes(q)
        if (!match) return false
      }
      if (moodFilter !== 'all' && s.mood !== moodFilter) return false
      if (blockerFilter === 'blocker' && !s.hasBlocker) return false
      if (blockerFilter === 'no-blocker' && s.hasBlocker) return false
      if (dateFrom && s.date < dateFrom) return false
      if (dateTo && s.date > dateTo) return false
      return true
    })
  }, [standups, search, moodFilter, blockerFilter, dateFrom, dateTo])

  const activeFilters = [
    search.trim() !== '',
    moodFilter !== 'all',
    blockerFilter !== 'all',
    dateFrom !== '',
    dateTo !== ''
  ].filter(Boolean).length

  const resetFilters = () => {
    setSearch('')
    setMoodFilter('all')
    setBlockerFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <PageShell>
      <PageHeader
        title="My history"
        subtitle="A complete record of all your standups"
        actions={
          <div className="text-right">
            <span className="tabular text-2xl font-bold text-brand-600 dark:text-brand-400">
              {standups.length}
            </span>
            <p className="text-xs text-content-subtle">Total</p>
          </div>
        }
      />

      {/* Search */}
      <motion.div variants={itemVariants} className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" />
        <Input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by keyword or date…"
          className="pl-10"
        />
      </motion.div>

      {/* Filter bar */}
      <motion.div variants={itemVariants} className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant={showFilters || activeFilters > 0 ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(v => !v)}
        >
          <IconFilter className="h-3.5 w-3.5" />
          Filters
          {activeFilters > 0 && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-700">
              {activeFilters}
            </span>
          )}
        </Button>

        <span className="tabular text-sm text-content-muted">
          {filtered.length} of {standups.length}
        </span>

        {activeFilters > 0 && (
          <button
            onClick={resetFilters}
            className="ml-auto text-xs font-medium text-red-500 hover:underline dark:text-red-400"
          >
            Reset all
          </button>
        )}
      </motion.div>

      {/* Filter panel */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="mb-4 space-y-4 rounded-card border border-line bg-surface p-4 shadow-card">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
                  Mood
                </p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map(mood => (
                    <Chip
                      key={mood}
                      active={moodFilter === mood}
                      onClick={() => setMoodFilter(mood)}
                    >
                      {mood !== 'all' && <span aria-hidden="true">{MOOD_ICON[mood]}</span>}
                      <span className="capitalize">{mood}</span>
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
                  Blocker
                </p>
                <div className="flex flex-wrap gap-2">
                  {BLOCKER_OPTIONS.map(opt => (
                    <Chip
                      key={opt.value}
                      active={blockerFilter === opt.value}
                      onClick={() => setBlockerFilter(opt.value)}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
                  Date range
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-content-muted">From</span>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-content-muted">To</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="py-2"
                    />
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter tags */}
      {activeFilters > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {search && (
              <FilterTag key="search" onClear={() => setSearch('')}>
                <IconSearch className="h-3 w-3" />
                &ldquo;{search}&rdquo;
              </FilterTag>
            )}
            {moodFilter !== 'all' && (
              <FilterTag key="mood" onClear={() => setMoodFilter('all')}>
                {MOOD_ICON[moodFilter]} <span className="capitalize">{moodFilter}</span>
              </FilterTag>
            )}
            {blockerFilter !== 'all' && (
              <FilterTag key="blocker" tone="danger" onClear={() => setBlockerFilter('all')}>
                {blockerFilter === 'blocker' ? 'Has blocker' : 'No blocker'}
              </FilterTag>
            )}
            {dateFrom && (
              <FilterTag key="from" tone="info" onClear={() => setDateFrom('')}>
                From {dateFrom}
              </FilterTag>
            )}
            {dateTo && (
              <FilterTag key="to" tone="info" onClear={() => setDateTo('')}>
                To {dateTo}
              </FilterTag>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : standups.length === 0 ? (
        <EmptyState
          icon={<IconInbox className="h-6 w-6" />}
          title="No standups submitted yet"
          description="Once you start submitting, your full history shows up here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSearch className="h-6 w-6" />}
          title="No standups match your filters"
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear all filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {filtered.map(s => (
              // Explicit props rather than variants: this wrapper owns the
              // entrance so the Card inside does not animate on top of it.
              <motion.div
                key={s._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: DURATION.base, ease: EASE }}
              >
                <StandupCard
                  standup={s}
                  questionLabels={questionLabels}
                  // The server only lets an author edit the day a standup
                  // covers, so offering the button on older ones would be a
                  // promise the API refuses
                  onEdit={s.date === todayForUser() ? setEditing : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {editing && (
        <EditStandupDialog
          standup={editing}
          questionLabels={questionLabels}
          onClose={() => setEditing(null)}
          onSaved={updated =>
            setStandups(list => list.map(s => (s._id === updated._id ? updated : s)))
          }
        />
      )}
    </PageShell>
  )
}
