import { motion } from 'framer-motion'
import { cn } from '../lib/cn'

/** Contents of the notification dropdown — kept out of the shell for clarity. */
export default function NotificationList({
  notifications,
  unreadCount,
  onMarkAllRead,
  onOpen
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-content">Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="scroll-slim max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-content-subtle">
            No notifications yet
          </p>
        ) : (
          notifications.map((n, i) => (
            <motion.button
              key={n._id}
              onClick={() => onOpen(n._id, n.link)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.2) }}
              className={cn(
                'w-full border-b border-line/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-sunken',
                !n.isRead && 'bg-brand-50/70 dark:bg-brand-950/40'
              )}
            >
              <div className="flex items-start gap-2">
                {!n.isRead && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                )}
                <div className={cn('min-w-0', n.isRead && 'pl-3.5')}>
                  <p className="text-sm text-content">{n.message}</p>
                  <p className="mt-1 text-xs text-content-subtle">
                    {new Date(n.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </motion.button>
          ))
        )}
      </div>
    </>
  )
}
