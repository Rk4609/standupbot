// import { useEffect, useState } from 'react'
// import API from '../api/axios'

// const moodEmoji = {
//   great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
// }

// const moodColor = {
//   great: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
//   good: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
//   okay: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
//   bad: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
//   stressed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
// }

// export default function History() {
//   const [standups, setStandups] = useState([])
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     const fetchHistory = async () => {
//       try {
//         const { data } = await API.get('/standups/my')
//         setStandups(data)
//       } catch (err) {
//         console.error(err)
//       } finally {
//         setLoading(false)
//       }
//     }
//     fetchHistory()
//   }, [])

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
//       <div className="max-w-3xl mx-auto">

//         {/* Header */}
//         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
//           📅 My History
//         </h1>
//         <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
//           A complete record of all your standups
//         </p>

//         {/* Loading */}
//         {loading ? (
//           <div className="text-center text-gray-400 dark:text-gray-500 py-10">
//             Loading...
//           </div>

//         /* Empty */
//         ) : standups.length === 0 ? (
//           <div className="text-center text-gray-400 dark:text-gray-500 py-10">
//             <p className="text-4xl mb-3">📭</p>
//             <p>No standups submitted yet</p>
//           </div>

//         /* List */
//         ) : (
//           <div className="space-y-4">
//             {standups.map(s => (
//               <div key={s._id}
//                 className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 transition-colors duration-200">

//                 {/* Header Row */}
//                 <div className="flex items-center justify-between mb-4">
//                   <div className="flex items-center gap-2">
//                     <span className="text-xl">{moodEmoji[s.mood]}</span>
//                     <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${moodColor[s.mood]}`}>
//                       {s.mood}
//                     </span>
//                     {s.hasBlocker && (
//                       <span className="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-medium">
//                         🚨 Blocker
//                       </span>
//                     )}
//                   </div>
//                   <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
//                     {s.date}
//                   </span>
//                 </div>

//                 {/* Content */}
//                 <div className="space-y-3">
//                   <div>
//                     <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
//                       Accomplished Yesterday
//                     </p>
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       {s.yesterday}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
//                       Today's Plan
//                     </p>
//                     <p className="text-sm text-gray-700 dark:text-gray-300">
//                       {s.today}
//                     </p>
//                   </div>
//                   {s.hasBlocker && (
//                     <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3">
//                       <p className="text-xs text-red-400 dark:text-red-500 uppercase tracking-wide mb-1">
//                         Blocker
//                       </p>
//                       <p className="text-sm text-red-700 dark:text-red-400">
//                         {s.blockers}
//                       </p>
//                     </div>
//                   )}
//                 </div>

//               </div>
//             ))}
//           </div>
//         )}

//       </div>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'

export default function History() {
  const [standups, setStandups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await API.get('/standups/my')
        setStandups(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          📅 My History
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          A complete record of all your standups
        </p>

        {/* Loading */}
        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            Loading...
          </div>

        /* Empty */
        ) : standups.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            <p className="text-4xl mb-3">📭</p>
            <p>No standups submitted yet</p>
          </div>

        /* List — StandupCard use ho raha hai */
        ) : (
          <div className="space-y-4">
            {standups.map(s => (
              <StandupCard key={s._id} standup={s} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}