# 🤖 StandupBot — Backend

A production-ready REST API for the StandupBot async daily standup tool, built with Node.js, Express.js, and MongoDB.

---

##  Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js 5 | Web framework |
| MongoDB + Mongoose 9 | Database + ODM |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Socket.io | Real-time notifications |
| Resend | Transactional email |
| node-cron | Scheduled jobs |
| Groq (GPT-OSS 120B) | AI analysis and weekly retros |
| Vitest + supertest | Tests |
| zod | Request validation |
| express-rate-limit + helmet | Abuse and header hardening |
| Cloudinary + Multer | Avatar uploads |

---

##  Folder Structure

```
backend/
├── config/
│   ├── db.js                  # MongoDB connection
│   └── cloudinary.js          # Cloudinary + multer upload config
├── controllers/
│   ├── authController.js      # Register, login, forgot/reset password
│   ├── standupController.js   # Standup CRUD + notifications
│   ├── teamController.js      # Team management
│   ├── userController.js      # Profile, password, avatar
│   └── aiController.js        # Groq-powered team analysis (SSE stream)
├── middleware/
│   ├── authMiddleware.js      # JWT verification
│   └── roleMiddleware.js      # Role-based access
├── models/
│   ├── User.js                # User schema
│   ├── Team.js                # Team schema
│   ├── Standup.js             # Standup schema
│   └── Notification.js        # Notification schema
├── routes/
│   ├── authRoutes.js          # /api/auth
│   ├── standupRoutes.js       # /api/standups
│   ├── teamRoutes.js          # /api/teams
│   ├── userRoutes.js          # /api/users
│   ├── notificationRoutes.js  # /api/notifications
│   └── aiRoutes.js            # /api/ai
├── middleware/
│   ├── rateLimiters.js        # Per-endpoint abuse limits
│   ├── validate.js            # zod request parsing
│   └── schemas.js             # Request schemas
├── services/
│   ├── emailService.js        # Resend email templates
│   ├── groqService.js         # Shared AI calls (stream + non-stream)
│   └── cronService.js         # Scheduled email jobs
├── scripts/                   # One-off migrations and seeders
├── tests/                     # Vitest + supertest suites
├── utils/week.js              # Mon-Fri week maths (UTC)
├── .env                       # Environment variables
├── package.json
├── app.js                     # Express app (importable by tests)
└── server.js                  # Entry: DB, socket.io, cron, listen
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/standupbot
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx

# AI analysis
GROQ_API_KEY=gsk_xxxxxxxxxxxx
# Optional — defaults to openai/gpt-oss-120b
# GROQ_MODEL=openai/gpt-oss-120b

# Avatar uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> **Note:** Gmail SMTP is blocked on Render, so email goes through the Resend API instead of Nodemailer.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Resend account (for email)
- Groq API key (for AI analysis)
- Cloudinary account (for avatars)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/standupbot.git

# Navigate to backend
cd standupbot/backend

# Install dependencies
npm install

# Start development server (nodemon)
npm run dev

# Or production
npm start
```

Server runs at `http://localhost:5000`

---

## 📡 API Endpoints

### Auth Routes — `/api/auth`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/register` | Register new user - always created as `employee` | Public |
| POST | `/login` | Login user | Public |
| POST | `/forgot-password` | Send password reset link | Public |
| GET | `/verify-reset-token/:token` | Check if reset link is still valid | Public |
| PUT | `/reset-password/:token` | Set a new password | Public |

### Standup Routes — `/api/standups`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Submit daily standup (one per day) | Protected |
| GET | `/my` | Get own standup history (last 30) | Protected |
| GET | `/team` | Get team standups (`?date=YYYY-MM-DD`) | Manager/Admin |
| GET | `/blockers` | Get team blockers | Manager/Admin |
| GET | `/stats` | Get weekly participation stats | Manager/Admin |
| PUT | `/:id/blocker` | Edit a blocker | Manager/Admin |
| DELETE | `/:id` | Delete a standup | Manager/Admin |

> Managers are scoped to their own team — editing or deleting another team's
> standup returns `403`. Only admins can act across all teams.

### Team Routes — `/api/teams`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create new team | Admin |
| POST | `/:id/members` | Add member to team | Admin |
| GET | `/` | Get all teams | Admin |

### User Routes — `/api/users`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all users | Admin |
| PATCH | `/:id/role` | Grant `employee` / `manager` / `admin` | Admin |
| GET | `/profile` | Own profile + stats + last 7 days activity | Protected |
| PUT | `/profile` | Update own name | Protected |
| PUT | `/change-password` | Change own password | Protected |
| POST | `/avatar` | Upload avatar (multipart, max 5MB, images only) | Protected |

### Notification Routes — `/api/notifications`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get latest 20 notifications | Protected |
| GET | `/unread-count` | Get unread count | Protected |
| PUT | `/read-all` | Mark all as read | Protected |
| PUT | `/:id/read` | Mark notification as read | Protected |

### AI Routes — `/api/ai`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/analyze-team` | Stream an AI team health report (SSE) | Manager/Admin |
| GET | `/test` | Health check for the AI router | Public |

`POST /analyze-team` accepts `{ "date": "YYYY-MM-DD" }` (defaults to today) and
responds with `text/event-stream`. Each chunk is `data: {"text":"..."}` and the
stream ends with `data: [DONE]`.

### Employee Routes — `/api/employees`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paged roster (`?page&limit&search&role&team`) | Manager/Admin |
| GET | `/summary` | Headline counts across the whole roster | Manager/Admin |
| GET | `/:id` | One employee with their recent standups | Manager/Admin |

`limit` accepts 10, 20, 50 or 100; anything else falls back to 20. A page past
the end clamps to the last page. Admins see everyone, a manager only their own
team.

### Retro Routes — `/api/retro`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Past retros, newest first | Manager/Admin |
| GET | `/current` | This week's retro, if generated | Manager/Admin |
| POST | `/generate` | Stream a retro for the week (SSE) and save it | Manager/Admin |

### Rate Limits

| Scope | Limit |
|-------|-------|
| Login | 10 / 15 min (successful sign-ins excluded) |
| Register, forgot-password | 5 / hour |
| AI and retro generation | 15 / 10 min, per user |
| Everything under `/api` | 200 / min |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Plain text OK response |
| GET | `/health` | `{ status, timestamp }` — keeps Render awake |

---

##  User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Manage teams, users, roles; view and edit all data |
| **Manager** | View and manage own team's standups, blockers, analytics, retros |
| **Employee** | Submit standup, view own history |

> Registration always creates an employee. Manager and admin are granted by an
> existing admin through `PATCH /api/users/:id/role` — the client cannot ask for
> a role at sign-up. An admin cannot change their own role, so an instance can
> never be left without one.

---

##  Authentication Flow

```
1. User registers → password hashed with bcrypt → saved to MongoDB
2. User logs in → password verified → JWT token generated (7 days)
3. Protected routes → JWT token verified via authMiddleware
4. Role routes → user role checked via roleMiddleware
5. Deleted users → token still valid but lookup fails → 401
```

### Password Reset Flow

```
1. POST /forgot-password → random 32-byte token generated
2. SHA-256 hash of the token stored on the user (1 hour expiry)
3. Raw token emailed as a link: CLIENT_URL/reset-password/<token>
4. PUT /reset-password/:token → hash matched, expiry checked, password updated
```

The endpoint always returns the same message whether or not the email exists,
so it cannot be used to enumerate accounts.

---

##  Email Schedule (Cron Jobs)

| Job | Schedule | Description |
|-----|----------|-------------|
| Morning Reminder | `0 9 * * 1-5` — 9:00 AM IST | Remind members who haven't submitted |
| EOD Summary | `0 18 * * 1-5` — 6:00 PM IST | Send team summary to manager |

Both jobs run with `timezone: 'Asia/Kolkata'`, so the cron expressions are in
IST — do not convert them to UTC.

---

##  Real-time Notifications (Socket.io)

Clients must send a JWT in the handshake; connections without a valid token are
rejected:

```js
io(API_URL, { auth: { token: '<jwt>' } })
```

On connect the server joins the socket to a room named after the user id from
the token — clients cannot pick their own room.

| Event | Trigger | Recipient |
|-------|---------|-----------|
| `standup:submitted` | Member submits standup | Manager |
| `blocker:added` | Standup has a blocker | Manager |
| `new-notification` | Any above event | Manager's browser |

---

##  Dependencies

See `package.json` for exact versions. Main ones:

```json
{
  "express": "^5.2.1",
  "mongoose": "^9.7.1",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",
  "socket.io": "^4.8.3",
  "resend": "^6.16.0",
  "node-cron": "^4.4.1",
  "cloudinary": "^2.8.0",
  "multer": "^1.4.5-lts.1",
  "dotenv": "^16.4.5",
  "cors": "^2.8.6"
}
```

> `dotenv` is pinned to v16 — v17+ breaks on Render.

---

## 🧪 Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage
```

Vitest with supertest and an in-memory MongoDB, so the suite needs no running
database and leaves no state behind. Each test file gets a fresh module
registry and each test a clean database, so order never matters.

| Suite | Covers |
|-------|--------|
| `auth` | registration, login, password reset, the role the client cannot set |
| `scoping` | who may read and change whose data, across every guarded route |
| `employees` | pagination, search, filters, and what must never be serialised |
| `standups` | submission rules, blocker detection, streak arithmetic |
| `roles` | granting roles, and the guards around it |
| `rateLimit` | the credential limits — isolated, since counters are module state |
| `week` | the date maths the weekly retro depends on |

CI runs these on every push along with the frontend lint, tests and build
(`.github/workflows/ci.yml`).

---

## 🌐 Deployment (Render)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repository
4. Set root directory: `backend`
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Add all environment variables (see above)
8. Deploy!

Set `CLIENT_URL` to the deployed frontend origin — it is used for the CORS
allowlist, Socket.io origins, and the links inside emails.

---

## Author
**Rakesh Jangid**
Full Stack Developer (MERN Stack)
