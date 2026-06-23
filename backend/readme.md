# 🤖 StandupBot — Backend

A production-ready REST API for the StandupBot async daily standup tool, built with Node.js, Express.js, and MongoDB.

---

##  Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB + Mongoose | Database + ODM |
| JWT | Authentication |
| bcryptjs | Password hashing |
| Socket.io | Real-time notifications |
| Nodemailer | Email service |
| node-cron | Scheduled jobs |

---

##  Folder Structure

```
backend/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── authController.js      # Register, Login
│   ├── standupController.js   # Standup CRUD + notifications
│   ├── teamController.js      # Team management
│   └── userController.js      # User management
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
│   └── notificationRoutes.js  # /api/notifications
├── services/
│   ├── emailService.js        # Nodemailer email templates
│   └── cronService.js         # Scheduled email jobs
├── .env                       # Environment variables
├── package.json
└── server.js                  # Entry point
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/standupbot
JWT_SECRET=your_super_secret_jwt_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **Note:** For Gmail, enable 2-Step Verification and generate an App Password.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Gmail account with App Password

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/standupbot.git

# Navigate to backend
cd standupbot/backend

# Install dependencies
npm install

# Start development server
npm start
```

Server runs at `http://localhost:5000`

---

## 📡 API Endpoints

### Auth Routes — `/api/auth`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/register` | Register new user | Public |
| POST | `/login` | Login user | Public |

### Standup Routes — `/api/standups`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Submit daily standup | Member |
| GET | `/my` | Get own standup history | Member |
| GET | `/team` | Get team standups | Manager/Admin |
| GET | `/blockers` | Get all blockers | Manager/Admin |
| GET | `/stats` | Get weekly participation stats | Manager/Admin |

### Team Routes — `/api/teams`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/` | Create new team | Admin |
| POST | `/:id/members` | Add member to team | Admin |
| GET | `/` | Get all teams | Admin |

### Notification Routes — `/api/notifications`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all notifications | Protected |
| GET | `/unread-count` | Get unread count | Protected |
| PUT | `/:id/read` | Mark notification as read | Protected |
| PUT | `/read-all` | Mark all as read | Protected |

### User Routes — `/api/users`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all users | Admin |

---

##  User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Manage teams, users, view all data |
| **Manager** | View team standups, blockers, analytics |
| **Member** | Submit standup, view own history |

---

##  Authentication Flow

```
1. User registers → password hashed with bcrypt → saved to MongoDB
2. User logs in → password verified → JWT token generated (7 days)
3. Protected routes → JWT token verified via authMiddleware
4. Role routes → user role checked via roleMiddleware
```

---

##  Email Schedule (Cron Jobs)

| Job | Schedule | Description |
|-----|----------|-------------|
| Morning Reminder | 9:00 AM IST (Mon-Fri) | Remind members who haven't submitted |
| EOD Summary | 6:00 PM IST (Mon-Fri) | Send team summary to manager |

---

##  Real-time Notifications (Socket.io)

| Event | Trigger | Recipient |
|-------|---------|-----------|
| `standup:submitted` | Member submits standup | Manager |
| `blocker:added` | Standup has a blocker | Manager |
| `new-notification` | Any above event | Manager's browser |

---

##  Dependencies

```json
{
  "express": "^4.x",
  "mongoose": "^8.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "socket.io": "^4.x",
  "nodemailer": "^6.x",
  "node-cron": "^3.x",
  "dotenv": "^16.x",
  "cors": "^2.x"
}
```

---

## 🌐 Deployment (Render)

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add all environment variables
7. Deploy!

---

## Author
**Rakesh Jangid**
Full Stack Developer (MERN Stack)