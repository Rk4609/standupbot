import { Link, useNavigate } from "react-router-dom"
import { removeUser } from "../store/authStore"
import { useState, useEffect } from "react"
import socket from "../socket"
import API from "../api/axios"

export default function Navbar({ user, setUser }) {
  const navigate = useNavigate()
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark",
  )
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.isRead).length

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  useEffect(() => {
    if (!user) return
    socket.connect()
    socket.emit("join", user._id)

    const fetchNotifications = async () => {
      try {
        const { data } = await API.get("/notifications")
        setNotifications(data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchNotifications()

    socket.on("new-notification", (notif) => {
      setNotifications((prev) => [notif, ...prev])
    })

    return () => {
      socket.off("new-notification")
      socket.disconnect()
    }
  }, [user])

  const markAllRead = async () => {
    try {
      await API.put("/notifications/read-all")
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (err) {
      console.error(err)
    }
  }

  const markRead = async (id, link) => {
    try {
      await API.put(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      )
      setShowDropdown(false)
      setMenuOpen(false)
      navigate(link)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    removeUser()
    setUser(null)
    socket.disconnect()
    navigate("/login")
  }

  const navLinks = (
    <>
      <Link
        to="/standup/new"
        onClick={() => setMenuOpen(false)}
        className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 transition text-sm py-2 md:py-0"
      >
        + New Standup
      </Link>
      <Link
        to="/history"
        onClick={() => setMenuOpen(false)}
        className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 transition text-sm py-2 md:py-0"
      >
        History
      </Link>
      {(user?.role === "manager" || user?.role === "admin") && (
        <>
          <Link
            to="/team"
            onClick={() => setMenuOpen(false)}
            className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 transition text-sm py-2 md:py-0"
          >
            Team
          </Link>
          <Link
            to="/blockers"
            onClick={() => setMenuOpen(false)}
            className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 transition text-sm py-2 md:py-0"
          >
            Blockers
          </Link>
        </>
      )}
      {user?.role === "admin" && (
        <Link
          to="/admin"
          onClick={() => setMenuOpen(false)}
          className="text-gray-600 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-400 transition text-sm py-2 md:py-0"
        >
          Admin
        </Link>
      )}
    </>
  )

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 px-4 md:px-6 py-3 transition-colors duration-200 relative">
      {/* Top Row */}
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/dashboard"
          className="font-bold text-purple-700 dark:text-purple-400 text-lg"
        >
          🤖 StandupBot
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          {navLinks}

          {/* 🔔 Bell */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-11 w-80 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-purple-700 dark:text-purple-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n._id}
                        onClick={() => markRead(n._id, n.link)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${
                          !n.isRead ? "bg-purple-50 dark:bg-purple-950" : ""
                        }`}
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-100">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dark Toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-lg"
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {/* User + Logout */}
          {/* <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-sm">{user?.name}</span>
            <button onClick={handleLogout}
              className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs hover:bg-purple-200 dark:hover:bg-purple-800 transition">
              Logout
            </button>
          </div> */}

          <Link
            to="/profile"
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover border border-purple-200 dark:border-purple-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-gray-500 dark:text-gray-400 text-sm hidden lg:block">
              {user?.name}
            </span>
          </Link>
        </div>

        {/* Mobile Right Icons */}
        <div className="flex md:hidden items-center gap-2">
          {/* Bell */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 transition"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Mobile Notification Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 top-11 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-purple-700 dark:text-purple-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center text-gray-400 py-6 text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n._id}
                        onClick={() => markRead(n._id, n.link)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition ${
                          !n.isRead ? "bg-purple-50 dark:bg-purple-950" : ""
                        }`}
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-100">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dark Toggle */}
          <button
            onClick={() => setDark(!dark)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 transition text-lg"
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 transition"
          >
            <span
              className={`block w-4 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`}
            />
            <span
              className={`block w-4 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-200 ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-4 h-0.5 bg-gray-600 dark:bg-gray-300 transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden mt-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-3 flex flex-col gap-1">
          {navLinks}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-500 dark:text-gray-400 text-sm flex-1">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs hover:bg-purple-200 dark:hover:bg-purple-800 transition"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
