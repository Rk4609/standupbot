
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
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
//       <div className="max-w-4xl mx-auto">

//         {/* Header */}
//         <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-5">
//           Team Dashboard 📊
//         </h1>

//         {/* Weekly Chart */}
//         <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-5">
//           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
//             Weekly Participation
//           </h2>
//           <ResponsiveContainer width="100%" height={180}>
//             <BarChart
//               data={stats}
//               margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
//             >
//               <XAxis
//                 dataKey="date"
//                 tick={{ fontSize: 10, fill: '#9ca3af' }}
//                 tickFormatter={(val) => val.slice(5)}
//               />
//               <YAxis
//                 allowDecimals={false}
//                 tick={{ fontSize: 10, fill: '#9ca3af' }}
//                 width={30}
//               />
//               <Tooltip
//                 contentStyle={{
//                   backgroundColor: '#1f2937',
//                   border: '1px solid #374151',
//                   borderRadius: '8px',
//                   color: '#f3f4f6',
//                   fontSize: '12px'
//                 }}
//               />
//               <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>

//         {/* Date Filter */}
//         <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4">
//           <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
//             Filter by Date:
//           </label>
//           <input type="date" value={date}
//             onChange={e => setDate(e.target.value)}
//             className="flex-1 min-w-0 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//           />
//           <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
//             {standups.length}{' '}
//             {standups.length === 1 ? 'submission' : 'submissions'}
//           </span>
//         </div>

//         {/* Team Standups */}
//         <div className="space-y-3">
//           {standups.length === 0 ? (
//             <div className="text-center text-gray-400 dark:text-gray-500 py-10 text-sm">
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

import { useEffect, useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import API from '../api/axios'
import StandupCard from '../components/StandupCard'

export default function TeamView() {
  const [standups, setStandups] = useState([])
  const [stats, setStats] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // AI states
  const [aiResult, setAiResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [showAi, setShowAi] = useState(false)
  const aiRef = useRef(null)

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

  // ✅ AI Analyze — Streaming
  const analyzeTeam = async () => {
    if (standups.length === 0) {
      setAiError('No standups found for this date! Ask team members to submit first.')
      setShowAi(true)
      return
    }

    setAiLoading(true)
    setAiResult('')
    setAiError('')
    setShowAi(true)

    try {
      const user = JSON.parse(localStorage.getItem('standupbot_user') || '{}')
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

      const response = await fetch(`${baseUrl}/ai/analyze-team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ date })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Analysis failed')
      }

      // ✅ Stream read karo
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                setAiResult(prev => prev + parsed.text)
                setTimeout(() => {
                  if (aiRef.current) {
                    aiRef.current.scrollTop = aiRef.current.scrollHeight
                  }
                }, 10)
              }
              if (parsed.error) {
                setAiError(parsed.error)
              }
            } catch (e) {
              // skip
            }
          }
        }
      }
    } catch (err) {
      setAiError(err.message || 'Something went wrong')
    } finally {
      setAiLoading(false)
    }
  }

  // ✅ AI text format karo
  const formatAiText = (text) => {
    return text.split('\n').map((line, i) => {
      // Bold headings **text**
      if (line.match(/^\*\*.*\*\*$/)) {
        return (
          <p key={i} className="font-bold text-gray-800 dark:text-gray-100 mt-4 mb-1 text-sm md:text-base">
            {line.replace(/\*\*/g, '')}
          </p>
        )
      }
      // Inline bold
      if (line.includes('**')) {
        const parts = line.split('**')
        return (
          <p key={i} className="text-gray-700 dark:text-gray-300 text-sm my-0.5">
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j} className="text-gray-800 dark:text-gray-100">{part}</strong>
                : part
            )}
          </p>
        )
      }
      // Bullet points
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <p key={i} className="text-gray-700 dark:text-gray-300 text-sm ml-4 my-0.5 flex gap-1">
            <span className="text-purple-500 flex-shrink-0">•</span>
            <span>{line.slice(2)}</span>
          </p>
        )
      }
      // Numbered list
      if (line.match(/^\d+\./)) {
        return (
          <p key={i} className="text-gray-700 dark:text-gray-300 text-sm ml-4 my-0.5">
            {line}
          </p>
        )
      }
      // Empty line
      if (line.trim() === '') return <div key={i} className="h-2" />
      // Normal text
      return (
        <p key={i} className="text-gray-700 dark:text-gray-300 text-sm my-0.5">
          {line}
        </p>
      )
    })
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(aiResult)
      alert('Report copied to clipboard! 📋')
    } catch {
      alert('Copy failed — please select text manually')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">

        {/* Header + AI Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">
            Team Dashboard 📊
          </h1>
          <button
            onClick={analyzeTeam}
            disabled={aiLoading}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-md"
          >
            {aiLoading
              ? <><span className="animate-spin inline-block">⚙️</span> Analyzing...</>
              : <>🧠 Analyze Team with AI</>
            }
          </button>
        </div>

        {/* ✅ AI Result Box */}
        {showAi && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-purple-200 dark:border-purple-800 p-4 md:p-6 mb-5 shadow-sm">

            {/* AI Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">🧠</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm md:text-base">
                  AI Team Health Analysis
                </span>
                {aiLoading && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full animate-pulse">
                    Generating...
                  </span>
                )}
                {!aiLoading && aiResult && (
                  <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                    ✅ Complete
                  </span>
                )}
              </div>
              <button
                onClick={() => { setShowAi(false); setAiResult(''); setAiError('') }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl transition"
              >
                ✕
              </button>
            </div>

            {/* Error */}
            {aiError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">❌ {aiError}</p>
              </div>
            )}

            {/* Loading skeleton */}
            {aiLoading && !aiResult && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mt-4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
              </div>
            )}

            {/* AI Result — Live streaming */}
            {aiResult && (
              <div
                ref={aiRef}
                className="max-h-80 md:max-h-96 overflow-y-auto pr-1"
              >
                {formatAiText(aiResult)}
                {/* Typing cursor */}
                {aiLoading && (
                  <span className="inline-block w-2 h-4 bg-purple-600 dark:bg-purple-400 animate-pulse ml-1 rounded-sm align-middle" />
                )}
              </div>
            )}

            {/* Footer buttons */}
            {aiResult && !aiLoading && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Powered by Groq • Llama 3.3 70B
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setAiResult(''); analyzeTeam() }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-purple-700 dark:hover:text-purple-400 transition"
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    onClick={copyReport}
                    className="text-xs text-purple-700 dark:text-purple-400 hover:underline"
                  >
                    📋 Copy Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Weekly Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 mb-5">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 text-sm md:text-base">
            Weekly Participation
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
              <StandupCard key={s._id} standup={s} showUser={true} />
            ))
          )}
        </div>

      </div>
    </div>
  )
}