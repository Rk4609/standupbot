export default function BlockerBadge({ text, compact = false }) {

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium">
        🚨 Blocker
      </span>
    )
  }

  return (
    <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="text-red-500 dark:text-red-400 font-semibold text-sm whitespace-nowrap">
          🚨 Blocker:
        </span>
        <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  )
}