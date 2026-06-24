// import { useState } from 'react'
// import { useNavigate } from 'react-router-dom'
// import toast from 'react-hot-toast'
// import API from '../api/axios'

// const moods = [
//   { value: 'great', emoji: '🚀', label: 'On Fire' },
//   { value: 'good', emoji: '😊', label: 'Feeling Good' },
//   { value: 'okay', emoji: '😐', label: 'Getting By' },
//   { value: 'bad', emoji: '😔', label: 'Struggling' },
//   { value: 'stressed', emoji: '😰', label: 'Overwhelmed' }
// ]

// export default function NewStandup() {
//   const [form, setForm] = useState({
//     yesterday: '', today: '', blockers: '', mood: 'good'
//   })
//   const [loading, setLoading] = useState(false)
//   const navigate = useNavigate()

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     setLoading(true)
//     try {
//       await API.post('/standups', form)
//       toast.success('Standup submitted successfully! 🎉')
//       navigate('/dashboard')
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Something went wrong')
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4 transition-colors duration-200">
//       <div className="max-w-2xl mx-auto">

//         {/* Header */}
//         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
//           Daily Standup 📋
//         </h1>
//         <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
//           {new Date().toLocaleDateString('en-US', {
//             weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
//           })}
//         </p>

//         <form onSubmit={handleSubmit} className="space-y-6">

//           {/* Question 1 */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3">
//               ✅ What did you accomplish yesterday?
//             </label>
//             <textarea required rows={3}
//               className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 resize-none transition"
//               placeholder="Describe the tasks you completed..."
//               value={form.yesterday}
//               onChange={e => setForm({ ...form, yesterday: e.target.value })}
//             />
//           </div>

//           {/* Question 2 */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3">
//               🎯 What are you working on today?
//             </label>
//             <textarea required rows={3}
//               className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 resize-none transition"
//               placeholder="Share your plan for today..."
//               value={form.today}
//               onChange={e => setForm({ ...form, today: e.target.value })}
//             />
//           </div>

//           {/* Question 3 */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3">
//               🚨 Any blockers or impediments?{' '}
//               <span className="text-gray-400 dark:text-gray-500 font-normal">
//                 (optional)
//               </span>
//             </label>
//             <textarea rows={2}
//               className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 resize-none transition"
//               placeholder="Anything slowing you down? Let your team know..."
//               value={form.blockers}
//               onChange={e => setForm({ ...form, blockers: e.target.value })}
//             />
//           </div>

//           {/* Mood */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <label className="block font-medium text-gray-700 dark:text-gray-200 mb-4">
//               💭 How are you feeling today?
//             </label>
//             <div className="flex gap-3 flex-wrap">
//               {moods.map(m => (
//                 <button type="button" key={m.value}
//                   onClick={() => setForm({ ...form, mood: m.value })}
//                   className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition ${
//                     form.mood === m.value
//                       ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 dark:border-purple-400'
//                       : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:bg-gray-800'
//                   }`}>
//                   <span className="text-2xl">{m.emoji}</span>
//                   <span className="text-xs text-gray-600 dark:text-gray-300">
//                     {m.label}
//                   </span>
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Submit */}
//           <button type="submit" disabled={loading}
//             className="w-full bg-purple-700 dark:bg-purple-600 text-white py-3 rounded-xl font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60 text-sm">
//             {loading ? 'Submitting...' : '🚀 Submit Standup'}
//           </button>

//         </form>
//       </div>
//     </div>
//   )
// }

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import API from '../api/axios'

const moods = [
  { value: 'great', emoji: '🚀', label: 'On Fire' },
  { value: 'good', emoji: '😊', label: 'Feeling Good' },
  { value: 'okay', emoji: '😐', label: 'Getting By' },
  { value: 'bad', emoji: '😔', label: 'Struggling' },
  { value: 'stressed', emoji: '😰', label: 'Overwhelmed' }
]

export default function NewStandup() {
  const [form, setForm] = useState({
    yesterday: '', today: '', blockers: '', mood: 'good'
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await API.post('/standups', form)
      toast.success('Standup submitted successfully! 🎉')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
          Daily Standup 📋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Question 1 */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
            <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3 text-sm md:text-base">
              ✅ What did you accomplish yesterday?
            </label>
            <textarea required rows={3}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 resize-none transition"
              placeholder="Describe the tasks you completed..."
              value={form.yesterday}
              onChange={e => setForm({ ...form, yesterday: e.target.value })}
            />
          </div>

          {/* Question 2 */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
            <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3 text-sm md:text-base">
              🎯 What are you working on today?
            </label>
            <textarea required rows={3}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 resize-none transition"
              placeholder="Share your plan for today..."
              value={form.today}
              onChange={e => setForm({ ...form, today: e.target.value })}
            />
          </div>

          {/* Question 3 */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
            <label className="block font-medium text-gray-700 dark:text-gray-200 mb-3 text-sm md:text-base">
              🚨 Any blockers or impediments?{' '}
              <span className="text-gray-400 dark:text-gray-500 font-normal text-xs md:text-sm">
                (optional)
              </span>
            </label>
            <textarea rows={2}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800 resize-none transition"
              placeholder="Anything slowing you down? Let your team know..."
              value={form.blockers}
              onChange={e => setForm({ ...form, blockers: e.target.value })}
            />
          </div>

          {/* Mood */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
            <label className="block font-medium text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
              💭 How are you feeling today?
            </label>
            {/* ✅ Mobile — 2 column grid, Desktop — 5 in a row */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
              {moods.map(m => (
                <button type="button" key={m.value}
                  onClick={() => setForm({ ...form, mood: m.value })}
                  className={`flex flex-col items-center gap-1 px-2 md:px-4 py-2.5 md:py-3 rounded-xl border-2 transition ${
                    form.mood === m.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 dark:border-purple-400'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 dark:bg-gray-800'
                  }`}>
                  <span className="text-xl md:text-2xl">{m.emoji}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 text-center leading-tight">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full bg-purple-700 dark:bg-purple-600 text-white py-3 md:py-3.5 rounded-xl font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition disabled:opacity-60 text-sm md:text-base">
            {loading ? 'Submitting...' : '🚀 Submit Standup'}
          </button>

        </form>
      </div>
    </div>
  )
}