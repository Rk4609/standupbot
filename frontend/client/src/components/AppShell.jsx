import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { removeUser } from '../store/authStore'
import socket from '../socket'
import API from '../api/axios'
import { cn } from '../lib/cn'
import { SPRING, popVariants } from '../lib/motion'
import NotificationList from './NotificationList'

/* Nav is grouped so the sidebar reads as sections rather than one long list */
const navGroups = (user) => {
  const isLead = user?.role === 'manager' || user?.role === 'admin'

  return [
    {
      label: null,
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
        { to: '/standup/new', label: 'New standup', icon: PlusIcon },
        { to: '/history', label: 'My history', icon: ClockIcon }
      ]
    },
    isLead && {
      label: 'Team',
      items: [
        { to: '/team', label: 'Overview', icon: UsersIcon },
        { to: '/blockers', label: 'Blockers', icon: AlertIcon },
        { to: '/retro', label: 'Weekly retro', icon: SparkIcon }
      ]
    },
    user?.role === 'admin' && {
      label: 'Manage',
      items: [{ to: '/admin', label: 'Admin', icon: ShieldIcon }]
    }
  ].filter(Boolean)
}

/* Inline icons keep the bundle free of an icon library for eight glyphs */
const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true'
}
function HomeIcon() {
  return <svg {...iconProps}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
}
function PlusIcon() {
  return <svg {...iconProps}><path d="M12 5v14M5 12h14" /></svg>
}
function ClockIcon() {
  return <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}
function UsersIcon() {
  return <svg {...iconProps}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6.4M17.5 20a6.6 6.6 0 0 0-2-4.7" /></svg>
}
function AlertIcon() {
  return <svg {...iconProps}><path d="M12 4 2.8 20h18.4L12 4Z" /><path d="M12 10v4M12 17.2v.1" /></svg>
}
function SparkIcon() {
  return <svg {...iconProps}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
}
function ShieldIcon() {
  return <svg {...iconProps}><path d="M12 3l7.5 3v6c0 4.4-3.1 7.8-7.5 9-4.4-1.2-7.5-4.6-7.5-9V6L12 3Z" /></svg>
}
function BellIcon() {
  return <svg {...iconProps}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></svg>
}

function NavItem({ to, label, icon: Icon, onNavigate, idPrefix }) {
  return (
    <NavLink to={to} onClick={onNavigate} className="relative block">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={`${idPrefix}-active`}
              transition={SPRING}
              className="absolute inset-0 rounded-lg bg-brand-600/10 dark:bg-brand-500/15"
            />
          )}
          {isActive && (
            <motion.span
              layoutId={`${idPrefix}-bar`}
              transition={SPRING}
              className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-600 dark:bg-brand-400"
            />
          )}
          <span
            className={cn(
              'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'font-medium text-brand-700 dark:text-brand-300'
                : 'text-content-muted hover:bg-surface-sunken hover:text-content'
            )}
          >
            <Icon />
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

function SidebarBody({ user, groups, idPrefix, onNavigate, onLogout }) {
  return (
    <>
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-3 py-1 font-semibold tracking-tight text-content"
      >
        <img src="/pwa-64x64.png" alt="" aria-hidden="true" className="h-7 w-7 rounded-lg" />
        StandupBot
      </Link>

      <nav className="mt-6 flex-1 space-y-6">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && <p className="eyebrow mb-1.5 px-3">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.to} {...item} idPrefix={idPrefix} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line pt-3">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-surface-sunken"
        >
          <Avatar user={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-content">{user?.name}</span>
            <span className="block truncate text-xs capitalize text-content-subtle">
              {user?.role}
            </span>
          </span>
        </Link>
        <button
          onClick={onLogout}
          className="mt-0.5 w-full rounded-lg px-3 py-2 text-left text-sm text-content-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
        >
          Sign out
        </button>
      </div>
    </>
  )
}

function Avatar({ user, size = 'sm' }) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs'

  if (user?.avatar) {
    return <img src={user.avatar} alt="" className={cn('rounded-full object-cover', dims)} />
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-600 font-semibold text-white',
        dims
      )}
    >
      {user?.name?.charAt(0).toUpperCase()}
    </div>
  )
}

export default function AppShell({ user, setUser, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const bellRef = useRef(null)
  const unreadCount = notifications.filter(n => !n.isRead).length
  const groups = navGroups(user)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (!showDropdown) return
    const onPointerDown = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowDropdown(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setShowDropdown(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showDropdown])

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!user) return
    socket.connect()

    API.get('/notifications')
      .then(({ data }) => setNotifications(data))
      .catch(err => console.error(err))

    socket.on('new-notification', notif => setNotifications(prev => [notif, ...prev]))
    socket.on('connect_error', err => console.error('Socket connection failed:', err.message))

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

  const closeDrawer = () => setDrawerOpen(false)

  const currentLabel =
    groups.flatMap(g => g.items).find(i => i.to === location.pathname)?.label || 'StandupBot'

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <SidebarBody
          user={user}
          groups={groups}
          idPrefix="desk"
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="no-print fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="no-print fixed inset-y-0 left-0 z-50 flex w-[16rem] flex-col border-r border-line bg-surface px-3 py-4 lg:hidden"
            >
              <SidebarBody
                user={user}
                groups={groups}
                idPrefix="mob"
                onNavigate={closeDrawer}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content column */}
      <div className="lg:pl-sidebar">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface-muted/80 px-4 py-3 backdrop-blur-md md:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-content-muted transition-colors hover:text-content lg:hidden"
          >
            <svg {...iconProps}>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <span className="flex-1 truncate text-sm font-medium text-content lg:text-content-muted">
            {currentLabel}
          </span>

          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setShowDropdown(v => !v)}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-content-muted transition-colors hover:text-content"
            >
              <BellIcon />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={SPRING}
                    className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  variants={popVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface-raised shadow-pop"
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

          <button
            onClick={() => setDark(v => !v)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-content-muted transition-colors hover:text-content"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={dark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="text-sm"
              >
                {dark ? '☀️' : '🌙'}
              </motion.span>
            </AnimatePresence>
          </button>
        </header>

        {children}
      </div>
    </div>
  )
}
