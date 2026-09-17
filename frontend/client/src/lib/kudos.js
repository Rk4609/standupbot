/** What kudos can be for, how it reads, and the mark beside it. */
export const VALUES = [
  { key: 'teamwork', label: 'Teamwork', emoji: '🤝' },
  { key: 'helpful', label: 'Helpful', emoji: '🙌' },
  { key: 'ownership', label: 'Ownership', emoji: '🎯' },
  { key: 'quality', label: 'Quality', emoji: '💎' },
  { key: 'extra-mile', label: 'Extra mile', emoji: '🚀' }
]

export const valueOf = (key) => VALUES.find(v => v.key === key) || VALUES[0]

/** "just now", "5m", "3h", "2d", then a date. */
export const ago = (when, now = Date.now()) => {
  const minutes = Math.floor((now - new Date(when)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
