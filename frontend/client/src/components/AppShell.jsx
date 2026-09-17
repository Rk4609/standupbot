import { useCallback, useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { removeUser, updateUser } from '../store/authStore'
import { workspaceSectionsFor } from '../lib/workspaceSections'
import socket from '../socket'
import API from '../api/axios'
import { cn } from '../lib/cn'
import { can } from '../lib/permissions'
import { SPRING, popVariants } from '../lib/motion'
import NotificationList from './NotificationList'
import { showNotificationToast } from '../lib/notificationToast'
import {
  IconAlert,
  IconBell,
  IconChart,
  IconClock,
  IconHome,
  IconInbox,
  IconMenu,
  IconMoon,
  IconPlus,
  IconSparkles,
  IconTarget,
  IconTimer,
  IconSun,
  IconTrendUp,
  IconUser,
  IconUsers
} from './ui/icons'

/**
 * What people open on a given day, grouped the way they think about it.
 *
 * Everything a team configures once lives behind Workspace. The groups used
 * to be sidebar sections; they are now the top bar — the personal ones as
 * pills, the team ones behind a single "Team" pill, and Workspace on its own
 * at the end, where settings usually sit.
 */
const navGroups = (user) => {
  // Each row names the module it belongs to, so a role that had that module
  // taken away loses the row rather than finding a page that refuses it
  const groups = [
    {
      id: 'mine',
      label: null,
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: IconHome, module: 'dashboard' },
        { to: '/standup/new', label: 'New standup', icon: IconPlus, module: 'standup' },
        { to: '/history', label: 'History', icon: IconClock, module: 'history' },
        { to: '/timesheet', label: 'Timesheet', icon: IconTimer, module: 'timesheet' },
        { to: '/support', label: 'Support', icon: IconInbox, module: 'support' }
      ]
    },
    {
      id: 'team',
      label: 'Team',
      items: [
        { to: '/team', label: 'Overview', icon: IconChart, module: 'team' },
        { to: '/employees', label: 'Employees', icon: IconUsers, module: 'employees' },
        { to: '/blockers', label: 'Blockers', icon: IconAlert, module: 'blockers' },
        { to: '/timesheets', label: 'Timesheets', icon: IconTimer, module: 'timesheets' },
        { to: '/analytics', label: 'Analytics', icon: IconTrendUp, module: 'analytics' },
        { to: '/retro', label: 'Weekly retro', icon: IconSparkles, module: 'retro' }
      ]
    },
    {
      // Every workspace section by name — the admin panel and roles used to
      // hide behind a single "Workspace" link, and at a narrow width behind
      // a scrolled-away tab as well
      id: 'manage',
      label: 'Workspace',
      items: workspaceSectionsFor(user).map(section => ({
        ...section,
        to: `/workspace/${section.to}`
      }))
    }
  ]

  return groups
    .map(group => ({ ...group, items: group.items.filter(i => can(user, i.module)) }))
    .filter(group => group.items.length > 0)
}

/** Small downward chevron for the pills that open a menu. */
function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
    >
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** The pill that marks where you are, shared so it slides between tabs. */
function ActivePill() {
  return (
    <motion.span
      layoutId="top-nav-active"
      transition={SPRING}
      className="absolute inset-0 rounded-full bg-brand-600 shadow-brand dark:bg-brand-400"
    />
  )
}

function TopLink({ to, label }) {
  return (
    <NavLink to={to} className="relative block shrink-0">
      {({ isActive }) => (
        <>
          {isActive && <ActivePill />}
          <span
            className={cn(
              'relative block whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
              isActive
                ? 'font-medium text-white dark:text-brand-700'
                : 'text-content-muted hover:text-content'
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

/** A floating list under a pill — the Team menu, and the account menu. */
function Menu({ children, align = 'left', className }) {
  return (
    <motion.div
      variants={popVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
      className={cn(
        'absolute top-11 z-50 overflow-hidden rounded-2xl border border-line bg-surface-raised p-1.5 shadow-pop',
        align === 'right' ? 'right-0' : 'left-0',
        className
      )}
      role="menu"
    >
      {children}
    </motion.div>
  )
}

function MenuLink({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      role="menuitem"
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-400/15 dark:text-brand-300'
            : 'text-content-muted hover:bg-surface-sunken hover:text-content'
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  )
}

/** Round icon button used along the right of the bar. */
const circle =
  'relative flex h-10 w-10 items-center justify-center rounded-full border border-line/80 bg-surface/80 text-content-muted backdrop-blur-sm transition-colors hover:text-content'

/* ------------------------------------------------------------------ */
/* Mobile drawer                                                        */
/* ------------------------------------------------------------------ */

function DrawerItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink to={to} onClick={onNavigate} className="relative block">
      {({ isActive }) => (
        <span
          className={cn(
            'relative flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors',
            isActive
              ? 'bg-brand-600 font-medium text-white dark:bg-brand-400 dark:text-brand-700'
              : 'text-content-muted hover:bg-surface-sunken hover:text-content'
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {label}
        </span>
      )}
    </NavLink>
  )
}

function DrawerBody({ user, groups, onNavigate, onLogout }) {
  return (
    <>
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="mx-1 inline-flex w-fit items-center rounded-full border border-line px-4 py-1.5 text-base tracking-tight text-content"
      >
        StandupBot
      </Link>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {groups.map(group => (
          <div key={group.id}>
            {group.label && <p className="eyebrow mb-1.5 px-3.5">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <DrawerItem key={item.to} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line pt-3">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-sunken"
        >
          <Avatar user={user} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-content">{user?.name}</span>
            <span className="block truncate text-xs capitalize text-content-subtle">
              {user?.roleName || user?.role}
            </span>
          </span>
        </Link>
        <button
          onClick={onLogout}
          className="mt-0.5 w-full rounded-full px-3.5 py-2 text-left text-sm text-content-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
        >
          Sign out
        </button>
      </div>
    </>
  )
}

function Avatar({ user, size = 'sm' }) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-xs'

  if (user?.avatar) {
    return <img src={user.avatar} alt="" className={cn('rounded-full object-cover', dims)} />
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-400 font-semibold text-brand-700',
        dims
      )}
    >
      {user?.name?.charAt(0).toUpperCase()}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shell                                                                */
/* ------------------------------------------------------------------ */

export default function AppShell({ user, setUser, children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [notifications, setNotifications] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  // One menu open at a time: 'team', 'bell', 'account' or null
  const [menu, setMenu] = useState(null)
  const teamRef = useRef(null)
  const workspaceRef = useRef(null)
  const bellRef = useRef(null)
  const accountRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.isRead).length
  const groups = navGroups(user)
  const mine = groups.find(g => g.id === 'mine')?.items || []
  const team = groups.find(g => g.id === 'team')?.items || []
  const manage = groups.find(g => g.id === 'manage')?.items || []

  const inTeam = team.some(i => location.pathname.startsWith(i.to))
  const inWorkspace = location.pathname.startsWith('/workspace')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  /**
   * Keep what this person may open in step with the server.
   *
   * The module list is saved at sign-in and was never read again, so a
   * module added later — or granted by an admin after they signed in — stayed
   * invisible until they signed out and back in. That is how Hiring,
   * Approvals and People records went missing for anybody with an older
   * session. It is asked for when the app opens and whenever the tab comes
   * back into focus, which is when somebody expects things to be current.
   */
  const token = user?.token
  useEffect(() => {
    if (!token) return
    let cancelled = false

    const sync = () =>
      API.get('/roles/me')
        .then(({ data }) => {
          if (cancelled || !data?.modules) return
          const changes = {
            modules: data.modules,
            roleName: data.role?.name || null,
            ...(data.role?.base ? { role: data.role.base } : {})
          }
          setUser(current => {
            if (!current) return current
            const unchanged =
              JSON.stringify(current.modules) === JSON.stringify(changes.modules) &&
              current.roleName === changes.roleName &&
              current.role === (changes.role || current.role)
            if (unchanged) return current
            return updateUser(changes) || { ...current, ...changes }
          })
        })
        .catch(() => {
          // Offline or signed out elsewhere: the stored list stands, and the
          // server still refuses anything it no longer allows
        })

    sync()
    window.addEventListener('focus', sync)
    return () => {
      cancelled = true
      window.removeEventListener('focus', sync)
    }
  }, [token, setUser])

  // Close whatever is open when the page changes underneath it. Keyed on the
  // path, so the state update is a response to navigation, not a render.
  const [seenPath, setSeenPath] = useState(location.pathname)
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname)
    setMenu(null)
    setDrawerOpen(false)
  }

  useEffect(() => {
    if (!menu) return
    // Read inside the effect: the element that counts as "inside" is the
    // wrapper of whichever menu is open
    const wrapper = {
      team: teamRef, workspace: workspaceRef, bell: bellRef, account: accountRef
    }[menu]
    const onPointerDown = (e) => {
      if (wrapper.current && !wrapper.current.contains(e.target)) setMenu(null)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  // Declared above the socket effect that reaches for it, and memoised so
  // that effect does not tear down and reconnect on every render
  // The router hands out a new `navigate` whenever the URL changes. Reading
  // it through a ref keeps openNotification — and the socket effect that
  // depends on it — the same across pages. Depending on it directly
  // disconnected and reconnected the socket, and refetched every
  // notification, on each click between pages or Workspace tabs.
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  const openNotification = useCallback(async (id, link) => {
    try {
      await API.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => (n._id === id ? { ...n, isRead: true } : n)))
      setMenu(null)
      navigateRef.current(link)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    socket.connect()

    API.get('/notifications')
      .then(({ data }) => setNotifications(data))
      .catch(err => console.error(err))

    socket.on('new-notification', notif => {
      setNotifications(prev => (prev.some(n => n._id === notif._id) ? prev : [notif, ...prev]))

      // The badge only counts. Something arriving while somebody is on
      // another page should say so, and take them there in one click.
      showNotificationToast(notif, n => openNotification(n._id, n.link))
    })
    socket.on('connect_error', err => console.error('Socket connection failed:', err.message))

    return () => {
      socket.off('new-notification')
      socket.off('connect_error')
      socket.disconnect()
    }
  }, [token, openNotification])

  const markAllRead = async () => {
    try {
      await API.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
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

  const toggle = (name) => setMenu(m => (m === name ? null : name))
  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="min-h-screen">
      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="no-print fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="no-print fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col rounded-r-card border-r border-line bg-surface px-3 py-5 lg:hidden"
            >
              <DrawerBody
                user={user}
                groups={groups}
                onNavigate={closeDrawer}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Top bar — the design's navigation: a name, a row of pills, and
          round controls at the end. On anything narrower than a laptop the
          pills fold into the drawer. */}
      <header className="no-print sticky top-0 z-30 px-4 pt-4 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-line/70 bg-surface-muted/70 p-1.5 pl-2 shadow-card backdrop-blur-md">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className={cn(circle, 'lg:hidden')}
          >
            <IconMenu className="h-[18px] w-[18px]" />
          </button>

          <Link
            to="/dashboard"
            className="shrink-0 rounded-full border border-content/25 px-4 py-1.5 text-[15px] tracking-tight text-content transition-colors hover:border-content/50"
          >
            StandupBot
          </Link>

          <nav
            aria-label="Main"
            // No overflow here: a scrolling container clips anything that
            // hangs below it, and the Team menu does. The pills fit from the
            // laptop width they appear at; below it they live in the drawer.
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
          >
            {mine.map(item => (
              <TopLink key={item.to} {...item} />
            ))}

            {team.length > 0 && (
              <div className="relative shrink-0" ref={teamRef}>
                <button
                  type="button"
                  onClick={() => toggle('team')}
                  aria-haspopup="menu"
                  aria-expanded={menu === 'team'}
                  className="relative block rounded-full"
                >
                  {inTeam && <ActivePill />}
                  <span
                    className={cn(
                      'relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                      inTeam
                        ? 'font-medium text-white dark:text-brand-700'
                        : 'text-content-muted hover:text-content'
                    )}
                  >
                    Team
                    <Chevron open={menu === 'team'} />
                  </span>
                </button>

                <AnimatePresence>
                  {menu === 'team' && (
                    <Menu className="w-56">
                      {team.map(item => (
                        <MenuLink key={item.to} {...item} onNavigate={() => setMenu(null)} />
                      ))}
                    </Menu>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
            {manage.length > 0 && (
              <div className="relative hidden md:block" ref={workspaceRef}>
                <button
                  type="button"
                  onClick={() => toggle('workspace')}
                  aria-haspopup="menu"
                  aria-expanded={menu === 'workspace'}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition-colors',
                    inWorkspace
                      ? 'border-transparent bg-brand-600 font-medium text-white dark:bg-brand-400 dark:text-brand-700'
                      : 'border-line/80 bg-surface/80 text-content-muted hover:text-content'
                  )}
                >
                  <IconTarget className="h-4 w-4" />
                  Workspace
                  <Chevron open={menu === 'workspace'} />
                </button>

                <AnimatePresence>
                  {menu === 'workspace' && (
                    <Menu align="right" className="w-60">
                      {manage.map(item => (
                        <MenuLink key={item.to} {...item} onNavigate={() => setMenu(null)} />
                      ))}
                    </Menu>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="relative" ref={bellRef}>
              <button
                onClick={() => toggle('bell')}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={menu === 'bell'}
                className={circle}
              >
                <IconBell className="h-[18px] w-[18px]" />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={SPRING}
                      className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-400 px-1 text-[10px] font-bold text-brand-700 ring-2 ring-surface-muted"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <AnimatePresence>
                {menu === 'bell' && (
                  <Menu align="right" className="w-[min(20rem,calc(100vw-2rem))] p-0">
                    <NotificationList
                      notifications={notifications}
                      unreadCount={unreadCount}
                      onMarkAllRead={markAllRead}
                      onOpen={openNotification}
                    />
                  </Menu>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setDark(v => !v)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={circle}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={dark ? 'sun' : 'moon'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex"
                >
                  {dark ? <IconSun className="h-[18px] w-[18px]" /> : <IconMoon className="h-[18px] w-[18px]" />}
                </motion.span>
              </AnimatePresence>
            </button>

            <div className="relative" ref={accountRef}>
              <button
                onClick={() => toggle('account')}
                aria-label="Your account"
                aria-haspopup="menu"
                aria-expanded={menu === 'account'}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line/80 bg-surface/80 backdrop-blur-sm"
              >
                <Avatar user={user} />
              </button>

              <AnimatePresence>
                {menu === 'account' && (
                  <Menu align="right" className="w-60">
                    <div className="px-3 pb-2 pt-1.5">
                      <p className="truncate text-sm font-medium text-content">{user?.name}</p>
                      <p className="truncate text-xs capitalize text-content-subtle">
                        {user?.roleName || user?.role}
                      </p>
                    </div>
                    <div className="border-t border-line pt-1.5">
                      <MenuLink
                        to="/profile"
                        label="My profile"
                        icon={IconUser}
                        onNavigate={() => setMenu(null)}
                      />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-content-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
                          <path
                            d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </Menu>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
