// // import { useEffect, useState } from 'react'
// // import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
// // import API from '../api/axios'

// // export default function TeamView() {
// //   const [standups, setStandups] = useState([])
// //   const [stats, setStats] = useState([])
// //   const [date, setDate] = useState(new Date().toISOString().split('T')[0])

// //   useEffect(() => {
// //     const fetchAll = async () => {
// //       try {
// //         const [s, st] = await Promise.all([
// //           API.get(`/standups/team?date=${date}`),
// //           API.get('/standups/stats')
// //         ])
// //         setStandups(s.data)
// //         setStats(st.data)
// //       } catch (err) {
// //         console.error(err)
// //       }
// //     }
// //     fetchAll()
// //   }, [date])

// //   const moodEmoji = {
// //     great: '🚀', good: '😊', okay: '😐', bad: '😔', stressed: '😰'
// //   }

// //   return (
// //     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
// //       <div className="max-w-4xl mx-auto">

// //         {/* Header */}
// //         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
// //           Team Dashboard 📊
// //         </h1>

// //         {/* Weekly Chart */}
// //         <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
// //           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
// //             Weekly Participation
// //           </h2>
// //           <ResponsiveContainer width="100%" height={200}>
// //             <BarChart data={stats}>
// //               <XAxis
// //                 dataKey="date"
// //                 tick={{ fontSize: 11, fill: '#9ca3af' }}
// //               />
// //               <YAxis
// //                 allowDecimals={false}
// //                 tick={{ fontSize: 11, fill: '#9ca3af' }}
// //               />
// //               <Tooltip
// //                 contentStyle={{
// //                   backgroundColor: '#1f2937',
// //                   border: '1px solid #374151',
// //                   borderRadius: '8px',
// //                   color: '#f3f4f6'
// //                 }}
// //               />
// //               <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
// //             </BarChart>
// //           </ResponsiveContainer>
// //         </div>

// //         {/* Date Filter */}
// //         <div className="flex items-center gap-3 mb-4">
// //           <label className="text-sm text-gray-600 dark:text-gray-400">
// //             Filter by Date:
// //           </label>
// //           <input type="date" value={date}
// //             onChange={e => setDate(e.target.value)}
// //             className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
// //           />
// //           <span className="text-sm text-gray-500 dark:text-gray-400">
// //             {standups.length} {standups.length === 1 ? 'submission' : 'submissions'}
// //           </span>
// //         </div>

// //         {/* Team Standups */}
// //         <div className="space-y-3">
// //           {standups.map(s => (
// //             <div key={s._id}
// //               className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 transition-colors duration-200">

// //               {/* User Row */}
// //               <div className="flex items-center justify-between mb-3">
// //                 <div className="flex items-center gap-3">
// //                   <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center font-medium text-sm">
// //                     {s.user.name.charAt(0).toUpperCase()}
// //                   </div>
// //                   <div>
// //                     <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
// //                       {s.user.name}
// //                     </p>
// //                     <p className="text-xs text-gray-400 dark:text-gray-500">
// //                       🔥 {s.user.streak} day streak
// //                     </p>
// //                   </div>
// //                 </div>
// //                 <span className="text-xl">{moodEmoji[s.mood]}</span>
// //               </div>

// //               {/* Standup Content */}
// //               <div className="space-y-2 text-sm">
// //                 <div>
// //                   <span className="text-gray-400 dark:text-gray-500 font-medium">
// //                     Accomplished Yesterday:{' '}
// //                   </span>
// //                   <span className="text-gray-700 dark:text-gray-300">
// //                     {s.yesterday}
// //                   </span>
// //                 </div>
// //                 <div>
// //                   <span className="text-gray-400 dark:text-gray-500 font-medium">
// //                     Today's Plan:{' '}
// //                   </span>
// //                   <span className="text-gray-700 dark:text-gray-300">
// //                     {s.today}
// //                   </span>
// //                 </div>
// //                 {s.hasBlocker && (
// //                   <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-3 py-2 mt-1">
// //                     <span className="text-red-500 dark:text-red-400 font-medium">
// //                       🚨 Blocker:{' '}
// //                     </span>
// //                     <span className="text-red-700 dark:text-red-400">
// //                       {s.blockers}
// //                     </span>
// //                   </div>
// //                 )}
// //               </div>

// //             </div>
// //           ))}

// //           {/* Empty State */}
// //           {standups.length === 0 && (
// //             <div className="text-center text-gray-400 dark:text-gray-500 py-10">
// //               No standups found for this date
// //             </div>
// //           )}
// //         </div>

// //       </div>
// //     </div>
// //   )
// // }
// import { useEffect, useState } from 'react'
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
// import API from '../api/axios'
// import StandupCard from '../components/StandupCard'

// export default function TeamView() {
//   const [standups, setStandups] = useState([])
//   const [stats, setStats] = useState([])
//   const [date, setDate] = useState(new Date().toISOString().split('T')[0])

//   useEffect(() => {
//     const fetchAll = async () => {
//       try {
//         const [s, st] = await Promise.all([
//           API.get(`/standups/team?date=${date}`),
//           API.get('/standups/stats')
//         ])
//         setStandups(s.data)
//         setStats(st.data)
//       } catch (err) {
//         console.error(err)
//       }
//     }
//     fetchAll()
//   }, [date])

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
//       <div className="max-w-4xl mx-auto">

//         {/* Header */}
//         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
//           Team Dashboard 📊
//         </h1>

//         {/* Weekly Chart */}
//         <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-6">
//           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//             Weekly Participation
//           </h2>
//           <ResponsiveContainer width="100%" height={200}>
//             <BarChart data={stats}>
//               <XAxis
//                 dataKey="date"
//                 tick={{ fontSize: 11, fill: '#9ca3af' }}
//               />
//               <YAxis
//                 allowDecimals={false}
//                 tick={{ fontSize: 11, fill: '#9ca3af' }}
//               />
//               <Tooltip
//                 contentStyle={{
//                   backgroundColor: '#1f2937',
//                   border: '1px solid #374151',
//                   borderRadius: '8px',
//                   color: '#f3f4f6'
//                 }}
//               />
//               <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>

//         {/* Date Filter */}
//         <div className="flex items-center gap-3 mb-4">
//           <label className="text-sm text-gray-600 dark:text-gray-400">
//             Filter by Date:
//           </label>
//           <input type="date" value={date}
//             onChange={e => setDate(e.target.value)}
//             className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//           />
//           <span className="text-sm text-gray-500 dark:text-gray-400">
//             {standups.length}{' '}
//             {standups.length === 1 ? 'submission' : 'submissions'}
//           </span>
//         </div>

//         {/* Team Standups — StandupCard use ho raha hai */}
//         <div className="space-y-3">
//           {standups.length === 0 ? (
//             <div className="text-center text-gray-400 dark:text-gray-500 py-10">
//               No standups found for this date
//             </div>
//           ) : (
//             standups.map(s => (
//               <StandupCard
//                 key={s._id}
//                 standup={s}
//                 showUser={true}
//               />
//             ))
//           )}
//         </div>

//       </div>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'

export default function TeamView() {
  const [standups, setStandups] = useState([])
  const [stats, setStats] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, st] = await Promise.all([
          API.get(`/standups/team?date=${date}`),
          API.get('/standups/stats')
        ])
        setStandups(s.data)
        setStats(st.data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchAll()
  }, [date])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-5">
          Team Dashboard 📊
        </h1>

        {/* Weekly Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-5">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
            Weekly Participation
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={stats}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={(val) => val.slice(5)}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Filter by Date:
          </label>
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="flex-1 min-w-0 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {standups.length}{' '}
            {standups.length === 1 ? 'submission' : 'submissions'}
          </span>
        </div>

        {/* Team Standups */}
        <div className="space-y-3">
          {standups.length === 0 ? (
            <div className="text-center text-gray-400 dark:text-gray-500 py-10 text-sm">
              No standups found for this date
            </div>
          ) : (
            standups.map(s => (
              <StandupCard
                key={s._id}
                standup={s}
                showUser={true}
              />
            ))
          )}
        </div>

      </div>
    </div>
  )
}