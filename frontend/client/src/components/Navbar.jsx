import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { removeUser } from '../store/authStore'
import socket from '../socket'
import API from '../api/axios'
import { cn } from '../lib/cn'
import { SPRING, collapseVariants, popVariants } from '../lib/motion'
import Button from './ui/Button'

/* ------------------------------------------------------------------ */
/* Declared at module scope: components created inside a render would  */
/* remount on every state change and lose focus / animation state.     */
/* ------------------------------------------------------------------ */

function Avatar({ user, size = 'sm' }) {
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className={cn(
          'rounded-full border-2 border-brand-200 object-cover dark:border-brand-800',
          dims
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300',
        dims
      )}
    >
      {user?.name?.charAt(0).toUpperCase()}
    </div>
  )
}

function IconButton({ label, onClick, children, className }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.9 }}
      transition={SPRING}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-sunken text-base transition-colors hover:bg-line',
        className
      )}
    >
      {children}
    </motion.button>
  )
}

function NotificationList({ notifications, unreadCount, onMarkAllRead, onOpen }) {
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

      <div className="scroll-slim max-h-72 overflow-y-auto">
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

/* ------------------------------------------------------------------ */

export default function Navbar({ user, setUser }) {
  const navigate = useNavigate()

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const bellRef = useRef(null)
  const unreadCount = notifications.filter(n => !n.isRead).length
  const isLead = user?.role === 'manager' || user?.role === 'admin'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // Close the notification dropdown on outside click / Escape
  useEffect(() => {
    if (!showDropdown) return

    const onPointerDown = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowDropdown(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowDropdown(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showDropdown])

  useEffect(() => {
    if (!user) return
    socket.connect()
    // Room join server side pe JWT se hota hai — yahan userId bhejne ki zarurat nahi

    const fetchNotifications = async () => {
      try {
        const { data } = await API.get('/notifications')
        setNotifications(data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchNotifications()

    socket.on('new-notification', (notif) => {
      setNotifications(prev => [notif, ...prev])
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection failed:', err.message)
    })

    return () => {
      socket.off('new-notification')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [user])

  const markAllRead = async () => {
    try {
      await API.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (err) {
      console.error(err)
    }
  }

  const openNotification = async (id, link) => {
    try {
      await API.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => (n._id === id ? { ...n, isRead: true } : n)))
      setShowDropdown(false)
      navigate(link)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    removeUser()
    setUser(null)
    socket.disconnect()
    navigate('/login')
  }

  const closeMenu = () => setMenuOpen(false)

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/standup/new', label: 'New Standup' },
    { to: '/history', label: 'History' },
    ...(isLead
      ? [
          { to: '/team', label: 'Team' },
          { to: '/blockers', label: 'Blockers' },
          { to: '/retro', label: 'Retro' }
        ]
      : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : [])
  ]

  return (
    <motion.nav
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="no-print sticky top-0 z-40 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-6"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between py-3">
        <Link
          to="/dashboard"
          onClick={closeMenu}
          className="flex items-center gap-2 font-bold text-content"
        >
          <img src="/pwa-64x64.png" alt="" aria-hidden="true" className="h-7 w-7 rounded-lg" />
          <span className="hidden sm:block">StandupBot</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} className="relative px-3 py-1.5">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      transition={SPRING}
                      className="absolute inset-0 rounded-lg bg-brand-100 dark:bg-brand-950"
                    />
                  )}
                  <span
                    className={cn(
                      'relative text-sm transition-colors',
                      isActive
                        ? 'font-medium text-brand-700 dark:text-brand-300'
                        : 'text-content-muted hover:text-content'
                    )}
                  >
                    {link.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={bellRef}>
            <IconButton
              label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              onClick={() => setShowDropdown(v => !v)}
            >
              🔔
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={SPRING}
                    className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </IconButton>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  variants={popVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-pop"
                >
                  <NotificationList
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onMarkAllRead={markAllRead}
                    onOpen={openNotification}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <IconButton
            label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark(v => !v)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={dark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {dark ? '☀️' : '🌙'}
              </motion.span>
            </AnimatePresence>
          </IconButton>

          {/* Desktop profile + logout */}
          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/profile"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Avatar user={user} />
              <span className="hidden text-sm text-content-muted lg:block">{user?.name}</span>
            </Link>
            <Button variant="subtle" size="xs" onClick={handleLogout}>
              Logout
            </Button>
          </div>

          {/* Mobile hamburger */}
          <IconButton
            label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden"
          >
            <span className="flex flex-col items-center justify-center gap-1">
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
                transition={SPRING}
                className="block h-0.5 w-4 rounded-full bg-content-muted"
              />
              <motion.span
                animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.15 }}
                className="block h-0.5 w-4 rounded-full bg-content-muted"
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                transition={SPRING}
                className="block h-0.5 w-4 rounded-full bg-content-muted"
              />
            </span>
          </IconButton>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden md:hidden"
          >
            <div className="space-y-1 border-t border-line py-3">
              {links.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + i * 0.035 }}
                >
                  <NavLink
                    to={link.to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                          : 'text-content-muted hover:bg-surface-sunken hover:text-content'
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </motion.div>
              ))}

              <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
                <Link
                  to="/profile"
                  onClick={closeMenu}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  <Avatar user={user} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{user?.name}</p>
                    <p className="text-xs capitalize text-content-subtle">{user?.role}</p>
                  </div>
                </Link>
                <Button variant="danger-subtle" size="xs" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
