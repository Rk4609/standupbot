# 🤖 StandupBot — Frontend

A modern React application for the StandupBot async daily standup tool, built with React 19, Vite 8, and Tailwind CSS.

---

##  Tech Stack

| Technology | Purpose |
|------------|---------|
| React 19 + Vite 8 | Frontend framework + build tool |
| React Router v6 | Client-side routing |
| Tailwind CSS v3 | Utility-first styling |
| Axios | HTTP client with interceptors |
| Socket.io Client | Real-time notifications |
| Recharts | Data visualization |
| React Hot Toast | Toast notifications |

---

## 📁 Folder Structure

```
frontend/client/
├── public/
├── src/
│   ├── api/
│   │   └── axios.js              # Axios instance + interceptors
│   ├── components/
│   │   ├── Navbar.jsx            # Navigation + bell notifications + dark mode
│   │   ├── ProtectedRoute.jsx    # Route guard (auth + role)
│   │   ├── StandupCard.jsx       # Reusable standup display card
│   │   └── BlockerBadge.jsx      # Reusable blocker badge
│   ├── pages/
│   │   ├── Login.jsx             # Login page
│   │   ├── Register.jsx          # Register page
│   │   ├── Dashboard.jsx         # Member dashboard
│   │   ├── NewStandup.jsx        # Submit standup form
│   │   ├── History.jsx           # Personal standup history
│   │   ├── TeamView.jsx          # Manager team dashboard + chart
│   │   ├── Blockers.jsx          # Active blockers list
│   │   └── AdminPanel.jsx        # Admin panel + charts
│   ├── store/
│   │   └── authStore.js          # Auth helpers (localStorage)
│   ├── socket.js                 # Socket.io client instance
│   ├── App.jsx                   # Root component + routes
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Tailwind imports
├── .env                          # Environment variables
├── index.html
├── package.json
├── tailwind.config.cjs
├── postcss.config.cjs
└── vite.config.js
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `frontend/client/` directory:

```env
VITE_API_URL=http://localhost:5000/api
```

For production:
```env
VITE_API_URL=https://your-backend.onrender.com/api
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- Backend server running

### Installation

```bash
# Navigate to frontend
cd standupbot/frontend/client

# Install dependencies
npm install

# Start development server
npm run dev
```

App runs at `http://localhost:5173`

---

##  Pages & Routes

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/login` | Login | Public | User login |
| `/register` | Register | Public | New account |
| `/dashboard` | Dashboard | All roles | Stats + today's standup status |
| `/standup/new` | NewStandup | All roles | Submit daily standup |
| `/history` | History | All roles | Personal standup history |
| `/team` | TeamView | Manager/Admin | Team standups + weekly chart |
| `/blockers` | Blockers | Manager/Admin | Active blockers |
| `/admin` | AdminPanel | Admin only | Manage teams + users + analytics |

---

##  Components

### `Navbar.jsx`
- Navigation links (role-based)
- 🔔 Real-time notification bell with unread count
- 🌙/☀️ Dark/Light mode toggle (persisted in localStorage)
- User avatar + logout

### `ProtectedRoute.jsx`
- Redirects unauthenticated users to `/login`
- Role-based access control (redirects unauthorized roles)

### `StandupCard.jsx`
- Reusable card displaying standup details
- Props: `standup` (data), `showUser` (boolean — show member info)
- Used in: History, TeamView, Blockers

### `BlockerBadge.jsx`
- Reusable blocker indicator
- Props: `text` (blocker text), `compact` (boolean — badge or full)
- Used in: StandupCard, Dashboard

---

##  Auth Flow

```
1. User registers/logs in → JWT token received
2. Token saved in localStorage via authStore.js
3. Axios interceptor adds Bearer token to every request
4. ProtectedRoute checks auth state
5. Role-based routes check user.role
6. Logout → token removed → redirect to /login
```

---

##  Real-time Notifications

```
1. User logs in → Socket.io connects
2. socket.emit('join', userId) → user joins personal room
3. Backend emits 'new-notification' → Navbar receives it
4. Bell icon shows red badge with unread count
5. Click bell → dropdown shows notifications
6. Click notification → mark as read → navigate to link
7. Logout → socket disconnects
```

---

##  Dark Mode

- Toggle button in Navbar (🌙/☀️)
- Uses Tailwind `dark:` classes throughout
- Preference saved in `localStorage`
- Persists across page refreshes

---

##  Charts (Recharts)

| Page | Chart Type | Data |
|------|-----------|------|
| TeamView | Bar Chart | Weekly standup participation (last 7 days) |
| AdminPanel | Bar Chart | Members per team |
| AdminPanel | Pie Chart (Donut) | User role distribution |

---

##  Dependencies

```json
{
  "react": "^19.x",
  "react-dom": "^19.x",
  "react-router-dom": "^6.x",
  "axios": "^1.x",
  "socket.io-client": "^4.x",
  "recharts": "^2.x",
  "react-hot-toast": "^2.x"
}
```

Dev dependencies:
```json
{
  "vite": "^8.x",
  "@vitejs/plugin-react": "^6.x",
  "tailwindcss": "^3.x",
  "autoprefixer": "^10.x",
  "postcss": "^8.x"
}
```

---

##  Deployment (Vercel)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import repository → select `frontend/client` as root directory
4. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
5. Deploy!

---

##  Author

**Rakesh Jangid**
Full Stack Developer (MERN Stack)