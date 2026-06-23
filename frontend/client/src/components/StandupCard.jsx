import BlockerBadge from './BlockerBadge'

const moodEmoji = {
  great: '🚀',
  good: '😊',
  okay: '😐',
  bad: '😔',
  stressed: '😰'
}

const moodColor = {
  great: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  good: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  okay: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  bad: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  stressed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
}

export default function StandupCard({ standup, showUser = false }) {
  const { user, yesterday, today, blockers, hasBlocker, mood, date } = standup

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 transition-colors duration-200">

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Show user info — TeamView mein */}
          {showUser && user && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-sm font-medium">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {user.name}
                </p>
                {user.streak > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    🔥 {user.streak} day streak
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Mood emoji + badge */}
          <span className="text-xl">{moodEmoji[mood]}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${moodColor[mood]}`}>
            {mood}
          </span>

          {/* Blocker badge */}
          {hasBlocker && <BlockerBadge compact />}

        </div>

        {/* Date */}
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">
          {date}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-3">

        {/* Yesterday */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            Accomplished Yesterday
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {yesterday}
          </p>
        </div>

        {/* Today */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            Today's Plan
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {today}
          </p>
        </div>

        {/* Blocker full text */}
        {hasBlocker && (
          <BlockerBadge text={blockers} />
        )}

      </div>
    </div>
  )
}