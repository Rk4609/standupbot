// import { useEffect, useState } from 'react'
// import API from '../api/axios'
// import toast from 'react-hot-toast'

// export default function AdminPanel() {
//   const [teams, setTeams] = useState([])
//   const [users, setUsers] = useState([])
//   const [teamForm, setTeamForm] = useState({ name: '', managerId: '' })
//   const [memberForm, setMemberForm] = useState({ teamId: '', userId: '' })

//   useEffect(() => {
//     fetchData()
//   }, [])

//   const fetchData = async () => {
//     try {
//       const [t, u] = await Promise.all([
//         API.get('/teams'),
//         API.get('/users')
//       ])
//       setTeams(t.data)
//       setUsers(u.data)
//     } catch (err) {
//       console.error(err)
//     }
//   }

//   const createTeam = async () => {
//     if (!teamForm.name) return toast.error('Please enter a team name!')
//     try {
//       await API.post('/teams', teamForm)
//       toast.success('Team created successfully! ✅')
//       setTeamForm({ name: '', managerId: '' })
//       fetchData()
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Something went wrong')
//     }
//   }

//   const addMember = async () => {
//     if (!memberForm.teamId || !memberForm.userId)
//       return toast.error('Please select both a team and a member!')
//     try {
//       await API.post(`/teams/${memberForm.teamId}/members`, {
//         userId: memberForm.userId
//       })
//       toast.success('Member added successfully! ✅')
//       setMemberForm({ teamId: '', userId: '' })
//       fetchData()
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Something went wrong')
//     }
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
//       <div className="max-w-4xl mx-auto">

//         {/* Header */}
//         <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
//           Admin Panel 🛡️
//         </h1>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

//           {/* Create Team */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//               ➕ Create New Team
//             </h2>
//             <div className="space-y-3">
//               <input
//                 type="text"
//                 placeholder="Enter team name"
//                 value={teamForm.name}
//                 onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
//                 className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//               />
//               <select
//                 value={teamForm.managerId}
//                 onChange={e => setTeamForm({ ...teamForm, managerId: e.target.value })}
//                 className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//               >
//                 <option value="">Select a manager</option>
//                 {users
//                   .filter(u => u.role === 'manager')
//                   .map(u => (
//                     <option key={u._id} value={u._id}>
//                       {u.name} ({u.email})
//                     </option>
//                   ))
//                 }
//               </select>
//               <button
//                 onClick={createTeam}
//                 className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition"
//               >
//                 Create Team
//               </button>
//             </div>
//           </div>

//           {/* Add Member */}
//           <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//             <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//               👤 Add Member to Team
//             </h2>
//             <div className="space-y-3">
//               <select
//                 value={memberForm.teamId}
//                 onChange={e => setMemberForm({ ...memberForm, teamId: e.target.value })}
//                 className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//               >
//                 <option value="">Select a team</option>
//                 {teams.map(t => (
//                   <option key={t._id} value={t._id}>{t.name}</option>
//                 ))}
//               </select>
//               <select
//                 value={memberForm.userId}
//                 onChange={e => setMemberForm({ ...memberForm, userId: e.target.value })}
//                 className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
//               >
//                 <option value="">Select a member</option>
//                 {users
//                   .filter(u => u.role === 'member')
//                   .map(u => (
//                     <option key={u._id} value={u._id}>
//                       {u.name} ({u.email})
//                     </option>
//                   ))
//                 }
//               </select>
//               <button
//                 onClick={addMember}
//                 className="w-full bg-green-600 dark:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 transition"
//               >
//                 Add Member
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Teams List */}
//         <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//             📋 All Teams
//           </h2>
//           {teams.length === 0 ? (
//             <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
//               No teams created yet
//             </p>
//           ) : (
//             <div className="space-y-3">
//               {teams.map(t => (
//                 <div key={t._id}
//                   className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
//                   <div>
//                     <p className="font-medium text-gray-800 dark:text-gray-100">
//                       {t.name}
//                     </p>
//                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
//                       Manager: {t.manager?.name || 'Not assigned'} •{' '}
//                       {t.members?.length || 0} members
//                     </p>
//                   </div>
//                   <div className="flex gap-1 flex-wrap justify-end">
//                     {t.members?.slice(0, 3).map(m => (
//                       <span key={m._id}
//                         className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
//                         {m.name}
//                       </span>
//                     ))}
//                     {t.members?.length > 3 && (
//                       <span className="text-xs text-gray-400 dark:text-gray-500">
//                         +{t.members.length - 3} more
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//         {/* Users List */}
//         <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
//           <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
//             👥 All Users
//           </h2>
//           {users.length === 0 ? (
//             <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
//               No users found
//             </p>
//           ) : (
//             <div className="divide-y divide-gray-50 dark:divide-gray-800">
//               {users.map(u => (
//                 <div key={u._id}
//                   className="flex items-center justify-between py-3">
//                   <div className="flex items-center gap-3">
//                     <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-sm font-medium">
//                       {u.name.charAt(0).toUpperCase()}
//                     </div>
//                     <div>
//                       <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
//                         {u.name}
//                       </p>
//                       <p className="text-xs text-gray-400 dark:text-gray-500">
//                         {u.email}
//                       </p>
//                     </div>
//                   </div>
//                   <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
//                     u.role === 'admin'
//                       ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
//                       : u.role === 'manager'
//                       ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
//                       : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
//                   }`}>
//                     {u.role}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>

//       </div>
//     </div>
//   )
// }

import { useEffect, useState } from 'react'
import API from '../api/axios'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#7c3aed', '#1D9E75', '#F59E0B', '#EF4444', '#3B82F6']

export default function AdminPanel() {
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' })
  const [memberForm, setMemberForm] = useState({ teamId: '', userId: '' })
  const [stats, setStats] = useState([])
  const [roleStats, setRoleStats] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [t, u] = await Promise.all([
        API.get('/teams'),
        API.get('/users')
      ])
      setTeams(t.data)
      setUsers(u.data)

      // ✅ Role distribution — Pie chart ke liye
      const roles = ['admin', 'manager', 'member']
      const roleCounts = roles.map(role => ({
        name: role.charAt(0).toUpperCase() + role.slice(1),
        value: u.data.filter(user => user.role === role).length
      }))
      setRoleStats(roleCounts)

      // ✅ Team wise member count — Bar chart ke liye
      const teamStats = t.data.map(team => ({
        name: team.name,
        members: team.members?.length || 0
      }))
      setStats(teamStats)

    } catch (err) {
      console.error(err)
    }
  }

  const createTeam = async () => {
    if (!teamForm.name) return toast.error('Please enter a team name!')
    try {
      await API.post('/teams', teamForm)
      toast.success('Team created successfully! ✅')
      setTeamForm({ name: '', managerId: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    }
  }

  const addMember = async () => {
    if (!memberForm.teamId || !memberForm.userId)
      return toast.error('Please select both a team and a member!')
    try {
      await API.post(`/teams/${memberForm.teamId}/members`, {
        userId: memberForm.userId
      })
      toast.success('Member added successfully! ✅')
      setMemberForm({ teamId: '', userId: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Admin Panel 🛡️
        </h1>

        {/* ✅ Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 text-center">
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
              {users.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Users
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {teams.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Teams
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-5 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {users.filter(u => u.role === 'member').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Total Members
            </div>
          </div>
        </div>

        {/* ✅ Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

          {/* Bar Chart — Team wise members */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Members per Team
            </h2>
            {stats.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                No teams yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6'
                    }}
                  />
                  <Bar dataKey="members" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart — Role distribution */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
              User Role Distribution
            </h2>
            {roleStats.every(r => r.value === 0) ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                No users yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={roleStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {roleStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6'
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Create Team + Add Member */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Create Team */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
              ➕ Create New Team
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Enter team name"
                value={teamForm.name}
                onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
              />
              <select
                value={teamForm.managerId}
                onChange={e => setTeamForm({ ...teamForm, managerId: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
              >
                <option value="">Select a manager</option>
                {users.filter(u => u.role === 'manager').map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <button
                onClick={createTeam}
                className="w-full bg-purple-700 dark:bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-800 dark:hover:bg-purple-700 transition"
              >
                Create Team
              </button>
            </div>
          </div>

          {/* Add Member */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
              👤 Add Member to Team
            </h2>
            <div className="space-y-3">
              <select
                value={memberForm.teamId}
                onChange={e => setMemberForm({ ...memberForm, teamId: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
              >
                <option value="">Select a team</option>
                {teams.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              <select
                value={memberForm.userId}
                onChange={e => setMemberForm({ ...memberForm, userId: e.target.value })}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 transition"
              >
                <option value="">Select a member</option>
                {users.filter(u => u.role === 'member').map(u => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <button
                onClick={addMember}
                className="w-full bg-green-600 dark:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 transition"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>

        {/* Teams List */}
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
            📋 All Teams
          </h2>
          {teams.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
              No teams created yet
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map(t => (
                <div key={t._id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Manager: {t.manager?.name || 'Not assigned'} •{' '}
                      {t.members?.length || 0} members
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {t.members?.slice(0, 3).map(m => (
                      <span key={m._id}
                        className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        {m.name}
                      </span>
                    ))}
                    {t.members?.length > 3 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        +{t.members.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">
            👥 All Users
          </h2>
          {users.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
              No users found
            </p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {users.map(u => (
                <div key={u._id}
                  className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center justify-center text-sm font-medium">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {u.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    u.role === 'admin'
                      ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                      : u.role === 'manager'
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                      : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}