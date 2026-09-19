export const AREA_LABEL = {
  quality: 'Quality of work',
  delivery: 'Delivers on time',
  teamwork: 'Teamwork',
  ownership: 'Ownership',
  communication: 'Communication'
}

export const RATING_LABEL = {
  1: 'Below expectations',
  2: 'Needs improvement',
  3: 'Meets expectations',
  4: 'Exceeds expectations',
  5: 'Outstanding'
}

export const REVIEW_STATUS = {
  self: { label: 'Self-review due', tone: 'warning' },
  manager: { label: 'With the manager', tone: 'info' },
  shared: { label: 'Shared', tone: 'brand' },
  acknowledged: { label: 'Done', tone: 'positive' }
}

/** "Mon 22 Sep, 11:00" */
export const meetingWhen = (date, time) => {
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return time ? `${day}, ${time}` : day
}

/** Upcoming first, soonest first; then what has been held, latest first. */
export const orderMeetings = (rows) => [
  ...rows.filter(r => r.status === 'upcoming').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
  ...rows.filter(r => r.status === 'done')
]
