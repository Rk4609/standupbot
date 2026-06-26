
import { useEffect, useState } from 'react'
import API from '../api/axios'
import toast from 'react-hot-toast'

export default function Blockers({ user }) {
  const [blockers, setBlockers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchBlockers()
  }, [])

  const fetchBlockers = async () => {
    try {
      setLoading(true)
      const { data } = await API.get('/standups/blockers')
      setBlockers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Edit blocker
  const handleEdit = (blocker) => {
    setEditId(blocker._id)
    setEditText(blocker.blockers)
    setDeleteId(null)
  }

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) {
      return toast.error('Blocker text empty nahi ho sakta!')
    }
    setActionLoading(true)
    try {
      await API.put(`/standups/${id}/blocker`, { blockers: editText })
      toast.success('Blocker updated! ✅')
      setEditId(null)
      fetchBlockers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setActionLoading(false)
    }
  }

  // ✅ Delete standup
  const handleDelete = async (id) => {
    setActionLoading(true)
    try {
      await API.delete(`/standups/${id}`)
      toast.success('Blocker deleted! 🗑️')
      setDeleteId(null)
      fetchBlockers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  const isAdmin = user?.role === 'admin'|| user?.role === 'manager'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
          🚨 Active Blockers
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
          All unresolved blockers from your team
          {isAdmin && (
            <span className="ml-2 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
              {user?.role === 'admin' ? 'Admin' : 'Manager'} — Edit & Delete enabled
            </span>
          )}
        </p>

        {/* Loading */}
        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            Loading...
          </div>

        /* No Blockers */
        ) : blockers.length === 0 ? (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-6 md:p-8 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="font-medium text-green-800 dark:text-green-300 text-sm md:text-base">
              No blockers reported!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Everything is running smoothly
            </p>
          </div>

        /* Blockers List */
        ) : (
          <div className="space-y-4">
            {blockers.map(b => (
              <div key={b._id}
                className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900 rounded-xl p-4 md:p-5 transition-colors duration-200">

                {/* User Info Row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 flex items-center justify-center font-medium text-sm flex-shrink-0">
                    {b.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                      {b.user.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {b.user.email} • {b.date}
                    </p>
                  </div>
                  <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
                    Blocker
                  </span>
                </div>

                {/* Blocker Text / Edit Mode */}
                {editId === b._id ? (
                  <div className="mb-3">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full border border-purple-300 dark:border-purple-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 resize-none transition"
                      placeholder="Edit blocker text..."
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleSaveEdit(b._id)}
                        disabled={actionLoading}
                        className="flex-1 bg-purple-700 dark:bg-purple-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-purple-800 transition disabled:opacity-60"
                      >
                        {actionLoading ? 'Saving...' : '✅ Save Changes'}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-3 mb-3">
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {b.blockers}
                    </p>
                  </div>
                )}

                {/* Today's Plan */}
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    Today's Plan:{' '}
                  </span>
                  {b.today}
                </div>

                {/* ✅ Admin Actions */}
                {isAdmin && editId !== b._id && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(b)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 py-2 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900 transition"
                    >
                      ✏️ Edit Blocker
                    </button>

                    {/* Delete Button */}
                    {deleteId === b._id ? (
                      <div className="flex-1 flex gap-1.5">
                        <button
                          onClick={() => handleDelete(b._id)}
                          disabled={actionLoading}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-medium hover:bg-red-700 transition disabled:opacity-60"
                        >
                          {actionLoading ? 'Deleting...' : '🗑️ Confirm'}
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setDeleteId(b._id); setEditId(null) }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-2 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition"
                      >
                        🗑️ Delete
                      </button>
                    )}

                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}