import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api/axios'
import toast from 'react-hot-toast'
import { saveUser } from '../store/authStore'

export default function Profile({ user, setUser }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [nameForm, setNameForm] = useState({ name: '' })
  const [passForm, setPassForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  })
  const [nameLoading, setNameLoading] = useState(false)
  const [passLoading, setPassLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const fileRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data } = await API.get('/users/profile')
      setProfile(data)
      setNameForm({ name: data.name })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      return toast.error('Image 5MB se badi nahi honi chahiye!')
    }

    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const { data } = await API.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      // Update local state + localStorage
      const updatedUser = { ...user, avatar: data.avatar }
      saveUser(updatedUser)
      setUser(updatedUser)
      setProfile(prev => ({ ...prev, avatar: data.avatar }))
      toast.success('Avatar updated! 🎉')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setAvatarLoading(false)
    }
  }

  // ✅ Name update
  const handleNameUpdate = async (e) => {
    e.preventDefault()
    setNameLoading(true)
    try {
      const { data } = await API.put('/users/profile', nameForm)
      const updatedUser = { ...user, name: data.name }
      saveUser(updatedUser)
      setUser(updatedUser)
      setProfile(prev => ({ ...prev, name: data.name }))
      toast.success('Name updated! ✅')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setNameLoading(false)
    }
  }

  // ✅ Password change
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      return toast.error('New passwords match nahi karte!')
    }
    setPassLoading(true)
    try {
      await API.put('/users/change-password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      toast.success('Password changed! 🔒')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed')
    } finally {
      setPassLoading(false)
    }
  }

  const roleColor = {
    admin: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
    manager: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    member: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
  }

  const moodEmoji = {
    great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
  }

  // Last 7 days activity
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    last7Days.push(d.toISOString().split('T')[0])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          My Profile 👤
        </h1>

        {/* Avatar + Info Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-purple-100 dark:border-purple-800"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-3xl font-bold border-4 border-purple-100 dark:border-purple-800">
                  {profile?.name?.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Upload button */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarLoading}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-700 dark:bg-purple-600 text-white rounded-full flex items-center justify-center text-sm hover:bg-purple-800 transition shadow-md disabled:opacity-60"
                title="Change avatar"
              >
                {avatarLoading ? '⏳' : '📷'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {profile?.name}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {profile?.email}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColor[profile?.role]}`}>
                  {profile?.role}
                </span>
                {profile?.team && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-full">
                    Team: {profile.team.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Member since {new Date(profile?.createdAt).toLocaleDateString('en-US', {
                  month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {profile?.streak || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Day Streak 🔥
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {profile?.totalStandups || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Total Standups
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {profile?.submittedDates?.length || 0}/7
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                This Week
              </div>
            </div>
          </div>

          {/* Last 7 days activity */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wide font-medium">
              Last 7 Days Activity
            </p>
            <div className="flex gap-2 justify-between">
              {last7Days.map(day => {
                const submitted = profile?.submittedDates?.includes(day)
                const isToday = day === new Date().toISOString().split('T')[0]
                return (
                  <div key={day} className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition ${
                      submitted
                        ? 'bg-purple-500 dark:bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    } ${isToday ? 'ring-2 ring-purple-400 ring-offset-1' : ''}`}>
                      {submitted ? '✓' : '–'}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(day).toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['profile', 'password'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === tab
                  ? 'bg-purple-700 dark:bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab === 'profile' ? '✏️ Edit Profile' : '🔒 Change Password'}
            </button>
          ))}
        </div>

        {/* Edit Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
              Edit Profile
            </h2>
            <form onSubmit={handleNameUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={nameForm.name}
                  onChange={e => setNameForm({ name: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                 Email cannot be changed.
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  disabled
                  value={profile?.role}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed capitalize"
                />
              </div>
              <button
                type="submit"
                disabled={nameLoading}
                className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60"
              >
                {nameLoading ? 'Saving...' : '✅ Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Change Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
              Change Password
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={passForm.currentPassword}
                  onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={passForm.newPassword}
                  onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={passForm.confirmPassword}
                  onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 transition ${
                    passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-200 dark:border-gray-600 focus:ring-purple-300 dark:focus:ring-purple-600'
                  }`}
                  placeholder="Repeat new password"
                />
                {passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords match nahi karte!</p>
                )}
              </div>
              <button
                type="submit"
                disabled={passLoading || (passForm.confirmPassword && passForm.newPassword !== passForm.confirmPassword)}
                className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60"
              >
                {passLoading ? 'Changing...' : '🔒 Change Password'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}