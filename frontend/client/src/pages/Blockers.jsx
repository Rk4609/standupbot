// // import { useEffect, useState } from 'react'
// // import API from '../api/axios'

// // export default function Blockers() {
// //   const [blockers, setBlockers] = useState([])
// //   const [loading, setLoading] = useState(true)

// //   useEffect(() => {
// //     const fetch = async () => {
// //       try {
// //         const { data } = await API.get('/standups/blockers')
// //         setBlockers(data)
// //       } catch (err) {
// //         console.error(err)
// //       } finally {
// //         setLoading(false)
// //       }
// //     }
// //     fetch()
// //   }, [])

// //   return (
// //     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
// //       <div className="max-w-3xl mx-auto">

// //         {/* Header */}
// //         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
// //           🚨 Active Blockers
// //         </h1>
// //         <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
// //           All unresolved blockers from your team
// //         </p>

// //         {/* Loading */}
// //         {loading ? (
// //           <div className="text-center text-gray-400 dark:text-gray-500 py-10">
// //             Loading...
// //           </div>

// //         /* No Blockers */
// //         ) : blockers.length === 0 ? (
// //           <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
// //             <p className="text-2xl mb-2">🎉</p>
// //             <p className="font-medium text-green-800 dark:text-green-300">
// //               No blockers reported!
// //             </p>
// //             <p className="text-sm text-green-600 dark:text-green-400 mt-1">
// //               Everything is running smoothly
// //             </p>
// //           </div>

// //         /* Blockers List */
// //         ) : (
// //           <div className="space-y-4">
// //             {blockers.map(b => (
// //               <div key={b._id}
// //                 className="bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900 rounded-xl p-5 transition-colors duration-200">

// //                 {/* User Info */}
// //                 <div className="flex items-center gap-3 mb-3">
// //                   <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 flex items-center justify-center font-medium text-sm">
// //                     {b.user.name.charAt(0).toUpperCase()}
// //                   </div>
// //                   <div>
// //                     <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">
// //                       {b.user.name}
// //                     </p>
// //                     <p className="text-xs text-gray-400 dark:text-gray-500">
// //                       {b.user.email} • {b.date}
// //                     </p>
// //                   </div>
// //                   <span className="ml-auto text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-3 py-1 rounded-full font-medium">
// //                     Blocker
// //                   </span>
// //                 </div>

// //                 {/* Blocker Text */}
// //                 <div className="bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 rounded-lg px-4 py-3">
// //                   <p className="text-sm text-red-700 dark:text-red-400">
// //                     {b.blockers}
// //                   </p>
// //                 </div>

// //                 {/* Today's Plan */}
// //                 <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
// //                   <span className="font-medium text-gray-600 dark:text-gray-300">
// //                     Today's Plan:{' '}
// //                   </span>
// //                   {b.today}
// //                 </div>

// //               </div>
// //             ))}
// //           </div>
// //         )}

// //       </div>
// //     </div>
// //   )

// // }

// import { useEffect, useState } from 'react'
// import API from '../api/axios'
// import StandupCard from '../components/StandupCard'

// export default function Blockers() {
//   const [blockers, setBlockers] = useState([])
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     const fetch = async () => {
//       try {
//         const { data } = await API.get('/standups/blockers')
//         setBlockers(data)
//       } catch (err) {
//         console.error(err)
//       } finally {
//         setLoading(false)
//       }
//     }
//     fetch()
//   }, [])

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
//       <div className="max-w-3xl mx-auto">

//         {/* Header */}
//         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
//           🚨 Active Blockers
//         </h1>
//         <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
//           All unresolved blockers from your team
//         </p>

//         {/* Loading */}
//         {loading ? (
//           <div className="text-center text-gray-400 dark:text-gray-500 py-10">
//             Loading...
//           </div>

//         /* No Blockers */
//         ) : blockers.length === 0 ? (
//           <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
//             <p className="text-2xl mb-2">🎉</p>
//             <p className="font-medium text-green-800 dark:text-green-300">
//               No blockers reported!
//             </p>
//             <p className="text-sm text-green-600 dark:text-green-400 mt-1">
//               Everything is running smoothly
//             </p>
//           </div>

//         /* Blockers List — StandupCard use ho raha hai */
//         ) : (
//           <div className="space-y-4">
//             {blockers.map(b => (
//               <StandupCard
//                 key={b._id}
//                 standup={b}
//                 showUser={true}
//               />
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

export default function Blockers() {
  const [blockers, setBlockers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await API.get('/standups/blockers')
        setBlockers(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
          🚨 Active Blockers
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">
          All unresolved blockers from your team
        </p>

        {loading ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10">
            Loading...
          </div>
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
        ) : (
          <div className="space-y-4">
            {blockers.map(b => (
              <StandupCard
                key={b._id}
                standup={b}
                showUser={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}