import { useEffect, useState, useMemo } from 'react'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'

const MOODS = ['all', 'great', 'good', 'okay', 'bad', 'stressed']
const moodEmoji = {
  all: '🔍', great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
}

export default function History() {
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(true)

  // ✅ Filter states
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState('all')
  const [blockerFilter, setBlockerFilter] = useState('all') // all | blocker | no-blocker
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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

  // ✅ useMemo — filters apply karo
  const filtered = useMemo(() => {
    return standups.filter(s => {

      // Search filter — yesterday, today, blockers mein dhundho
      if (search.trim()) {
        const q = search.toLowerCase()
        const match =
          s.yesterday?.toLowerCase().includes(q) ||
          s.today?.toLowerCase().includes(q) ||
          s.blockers?.toLowerCase().includes(q) ||
          s.date?.includes(q)
        if (!match) return false
      }

      // Mood filter
      if (moodFilter !== 'all' && s.mood !== moodFilter) return false

      // Blocker filter
      if (blockerFilter === 'blocker' && !s.hasBlocker) return false
      if (blockerFilter === 'no-blocker' && s.hasBlocker) return false

      // Date from filter
      if (dateFrom && s.date < dateFrom) return false

      // Date to filter
      if (dateTo && s.date > dateTo) return false

      return true
    })
  }, [standups, search, moodFilter, blockerFilter, dateFrom, dateTo])

  // ✅ Active filters count
  const activeFilters = [
    search.trim() !== '',
    moodFilter !== 'all',
    blockerFilter !== 'all',
    dateFrom !== '',
    dateTo !== ''
  ].filter(Boolean).length

  // ✅ Reset all filters
  const resetFilters = () => {
    setSearch('')
    setMoodFilter('all')
    setBlockerFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
              📅 My History
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              A complete record of all your standups
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {standups.length}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500">Total</p>
          </div>
        </div>

        {/* ✅ Search Bar */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by keyword, date..."
            className="w-full pl-9 pr-10 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* ✅ Filter Toggle Button */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
              showFilters || activeFilters > 0
                ? 'bg-purple-700 dark:bg-purple-600 text-white border-purple-700'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            ⚙️ Filters
            {activeFilters > 0 && (
              <span className="bg-white text-purple-700 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {activeFilters}
              </span>
            )}
          </button>

          {/* Result count */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} of {standups.length} standups
          </span>

          {/* Reset */}
          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-red-500 dark:text-red-400 hover:underline"
            >
              Reset all
            </button>
          )}
        </div>

        {/* ✅ Filters Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mb-4 space-y-4">

            {/* Mood Filter */}
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-2">
                Filter by Mood
              </p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map(mood => (
                  <button
                    key={mood}
                    onClick={() => setMoodFilter(mood)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      moodFilter === mood
                        ? 'bg-purple-700 dark:bg-purple-600 text-white border-purple-700'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-purple-300'
                    }`}
                  >
                    <span>{moodEmoji[mood]}</span>
                    <span className="capitalize">{mood}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Blocker Filter */}
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-2">
                Filter by Blocker
              </p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: '📋 All' },
                  { value: 'blocker', label: '🚨 Has Blocker' },
                  { value: 'no-blocker', label: '✅ No Blocker' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBlockerFilter(opt.value)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                      blockerFilter === opt.value
                        ? 'bg-purple-700 dark:bg-purple-600 text-white border-purple-700'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-purple-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium mb-2">
                Filter by Date Range
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ✅ Active Filter Tags */}
        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {search && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full">
                🔍 "{search}"
                <button onClick={() => setSearch('')} className="hover:text-purple-900 dark:hover:text-purple-100">✕</button>
              </span>
            )}
            {moodFilter !== 'all' && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full">
                {moodEmoji[moodFilter]} {moodFilter}
                <button onClick={() => setMoodFilter('all')} className="hover:text-purple-900">✕</button>
              </span>
            )}
            {blockerFilter !== 'all' && (
              <span className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full">
                {blockerFilter === 'blocker' ? '🚨 Has Blocker' : '✅ No Blocker'}
                <button onClick={() => setBlockerFilter('all')} className="hover:text-red-900">✕</button>
              </span>
            )}
            {dateFrom && (
              <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                From: {dateFrom}
                <button onClick={() => setDateFrom('')} className="hover:text-blue-900">✕</button>
              </span>
            )}
            {dateTo && (
              <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                To: {dateTo}
                <button onClick={() => setDateTo('')} className="hover:text-blue-900">✕</button>
              </span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            Loading...
          </div>

        /* No standups at all */
        ) : standups.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">No standups submitted yet</p>
          </div>

        /* No results after filter */
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No standups match your filters
            </p>
            <button
              onClick={resetFilters}
              className="mt-3 text-sm text-purple-700 dark:text-purple-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>

        /* Results */
        ) : (
          <div className="space-y-4">
            {filtered.map(s => (
              <StandupCard key={s._id} standup={s} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}