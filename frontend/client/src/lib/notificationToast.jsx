import toast from 'react-hot-toast'
import NotificationToast from '../components/NotificationToast'

/**
 * Raise the corner popup for one notification.
 *
 * Keyed by the notification's id: the same event arriving twice — a
 * reconnect replaying it, say — replaces the toast instead of stacking a
 * second identical one.
 */
export const showNotificationToast = (notification, onOpen) =>
  toast.custom(
    t => <NotificationToast t={t} notification={notification} onOpen={onOpen} />,
    { duration: 6000, id: String(notification._id) }
  )
