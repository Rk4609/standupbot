// import { useEffect, useState } from 'react'
// import { Link } from 'react-router-dom'
// import API from '../api/axios'

// const moodEmoji = {
//   great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
// }

// export default function Dashboard({ user }) {
//   const [todayStandup, setTodayStandup] = useState(null)
//   const [recentStandups, setRecentStandups] = useState([])
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const { data } = await API.get('/standups/my')
//         const today = new Date().toISOString().split('T')[0]
//         setTodayStandup(data.find(s => s.date === today) || null)
//         setRecentStandups(data.slice(0, 5))
//       } catch (err) {
//         console.error(err)
//       } finally {
//         setLoading(false)
//       }
//     }
//     fetchData()
//   }, [])

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center transition-colors duration-200">
//         <p className="text-gray-400 dark:text-gray-500">Loading...</p>
//       </div>
//     )
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
//       <div className="max-w-3xl mx-auto">

//         {/* Welcome */}
//         <div className="mb-8">
//           <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
//             Welcome back, {user?.name}! 👋
//           </h1>
//           <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
//             {new Date().toLocaleDateString('en-US', {
//               weekday: 'long', month: 'long', day: 'numeric'
//             })}
//           </p>
//         </div>

//         {/* Stats */}
//         <div className="grid grid-cols-3 gap-4 mb-6">
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
//             <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
//               {user?.streak || 0}
//             </div>
//             <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
//               Day Streak 🔥
//             </div>
//           </div>
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
//             <div className="text-2xl font-bold text-green-600 dark:text-green-400">
//               {recentStandups.length}
//             </div>
//             <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
//               Total Standups
//             </div>
//           </div>
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 text-center">
//             <div className="text-2xl">
//               {todayStandup ? moodEmoji[todayStandup.mood] : '—'}
//             </div>
//             <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
//               Today's Mood
//             </div>
//           </div>
//         </div>

//         {/* Today status */}
//         {!todayStandup ? (
//           <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-6 flex items-center justify-between">
//             <div>
//               <p className="font-medium text-amber-800 dark:text-amber-300">
//                 Today's standup is pending!
//               </p>
//               <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
//                 Keep your team in the loop
//               </p>
//             </div>
//             <Link to="/standup/new"
//               className="bg-purple-700 dark:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition whitespace-nowrap">
//               Submit Now →
//             </Link>
//           </div>
//         ) : (
//           <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
//             <p className="font-medium text-green-800 dark:text-green-300">
//               ✅ Today's standup is submitted!
//             </p>
//             <p className="text-sm text-green-600 dark:text-green-400 mt-2">
//               <strong>Today's Plan:</strong> {todayStandup.today}
//             </p>
//             {todayStandup.hasBlocker && (
//               <p className="text-sm text-red-600 dark:text-red-400 mt-1">
//                 <strong>🚨 Blocker:</strong> {todayStandup.blockers}
//               </p>
//             )}
//           </div>
//         )}

//         {/* Recent Standups */}
//         <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//             Recent Standups
//           </h2>
//           {recentStandups.length === 0 ? (
//             <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
//               No standups yet — submit your first one! 🎯
//             </p>
//           ) : (
//             <div className="space-y-3">
//               {recentStandups.map(s => (
//                 <div key={s._id}
//                   className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
//                   <span className="text-xl">{moodEmoji[s.mood]}</span>
//                   <div className="flex-1 min-w-0">
//                     <div className="flex items-center gap-2 mb-1">
//                       <span className="text-xs text-gray-400 dark:text-gray-500">
//                         {s.date}
//                       </span>
//                       {s.hasBlocker && (
//                         <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
//                           Blocker
//                         </span>
//                       )}
//                     </div>
//                     <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
//                       {s.today}
//                     </p>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//           <Link to="/history"
//             className="text-purple-700 dark:text-purple-400 text-sm hover:underline mt-3 block text-center">
//             View full history →
//           </Link>
//         </div>

//       </div>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import API from '../api/axios'

const moodEmoji = {
  great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
}

export default function Dashboard({ user }) {
  const [todayStandup, setTodayStandup] = useState(null)
  const [recentStandups, setRecentStandups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await API.get('/standups/my')
        const today = new Date().toISOString().split('T')[0]
        setTodayStandup(data.find(s => s.date === today) || null)
        setRecentStandups(data.slice(0, 5))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* Stats — 3 cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl font-bold text-purple-700 dark:text-purple-400">
              {user?.streak || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              Day Streak 🔥
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
              {recentStandups.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              Standups
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl">
              {todayStandup ? moodEmoji[todayStandup.mood] : '—'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              Today's Mood
            </div>
          </div>
        </div>

        {/* Today status */}
        {!todayStandup ? (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 md:p-6 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300 text-sm md:text-base">
                  Today's standup is pending!
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Keep your team in the loop
                </p>
              </div>
              <Link to="/standup/new"
                className="bg-purple-700 dark:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition text-center whitespace-nowrap">
                Submit Now →
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 md:p-6 mb-5">
            <p className="font-medium text-green-800 dark:text-green-300 text-sm md:text-base">
              ✅ Today's standup is submitted!
            </p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              <strong>Today's Plan:</strong> {todayStandup.today}
            </p>
            {todayStandup.hasBlocker && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                <strong>🚨 Blocker:</strong> {todayStandup.blockers}
              </p>
            )}
          </div>
        )}

        {/* Recent Standups */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
            Recent Standups
          </h2>
          {recentStandups.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
              No standups yet — submit your first one! 🎯
            </p>
          ) : (
            <div className="space-y-3">
              {recentStandups.map(s => (
                <div key={s._id}
                  className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <span className="text-xl flex-shrink-0">{moodEmoji[s.mood]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {s.date}
                      </span>
                      {s.hasBlocker && (
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                          Blocker
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {s.today}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/history"
            className="text-purple-700 dark:text-purple-400 text-sm hover:underline mt-3 block text-center">
            View full history →
          </Link>
        </div>

      </div>
    </div>
  )
}