export const MOOD_EMOJI = {
  great: '🚀',
  good: '😊',
  okay: '😐',
  bad: '😔',
  stressed: '😰'
}

/** Badge tone per mood — used by StandupCard and the history filters. */
export const MOOD_TONE = {
  great: 'positive',
  good: 'info',
  okay: 'warning',
  bad: 'warning',
  stressed: 'danger'
}

export const MOOD_OPTIONS = [
  { value: 'great', emoji: '🚀', label: 'On fire' },
  { value: 'good', emoji: '😊', label: 'Feeling good' },
  { value: 'okay', emoji: '😐', label: 'Getting by' },
  { value: 'bad', emoji: '😔', label: 'Struggling' },
  { value: 'stressed', emoji: '😰', label: 'Overwhelmed' }
]
