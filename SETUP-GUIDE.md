# Event App - Full Stack Setup Guide

## 🎯 Architecture

```
┌─────────────────────────┐
│   React Frontend        │
│ http://localhost:5173   │
│  (Leaflet Map App)      │
└────────────┬────────────┘
             │ HTTP API calls
             ↓
┌─────────────────────────┐
│  Express.js Backend     │
│ http://localhost:3000   │
│  (Connected to Supabase)│
└────────────┬────────────┘
             │
             ↓
    ┌───────────────┐
    │   Supabase    │
    │  PostgreSQL   │
    └───────────────┘
```

## 🚀 Quick Start - Choose One Method

### Method 1: PowerShell (Windows) - RECOMMENDED
```powershell
.\start.ps1
```

### Method 2: Bash (Git Bash, WSL, macOS, Linux)
```bash
bash start.sh
```

### Method 3: Manual - Two Terminal Windows

**Terminal 1 - Backend:**
```powershell
cd backend
npm install
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```powershell
cd Project
npm install
npm run dev
# Runs on http://localhost:5173
```

## 🔑 Environment Configuration

Backend .env is already configured with:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key for API
- `JWT_SECRET`: Secret for signing tokens
- `PORT`: 3000

## 👤 Default Users (for login)

| Username | Password  |
|----------|-----------|
| alice    | alice123  |
| bob      | bob123    |
| carol    | carol123  |
| dave     | dave123   |
| eve      | eve123    |

**Note:** Users must be created in Supabase first. Add them via:
```sql
INSERT INTO users (id, username, email, password_hash, created_at) VALUES
  ('user-1', 'alice', 'alice@example.com', bcrypt_hash('alice123'), now()),
  ('user-2', 'bob', 'bob@example.com', bcrypt_hash('bob123'), now()),
  -- etc...
```

## 📂 Project Structure

```
backend/
├── src/
│   ├── index.ts              ← Main Express app
│   ├── db.ts                 ← Not used (using Supabase)
│   ├── middleware/
│   │   └── auth.ts           ← JWT authentication
│   └── routes/
│       ├── auth.ts           ← Login/Register (+ new /login-username)
│       ├── events.ts         ← Event CRUD
│       ├── users.ts          ← User management
│       └── plans.ts          ← Plans (if needed)
├── .env                      ← Credentials (already configured)
└── package.json

Project/
├── src/
│   ├── App.tsx               ← Main component (updated to use API)
│   ├── api.ts                ← HTTP client for backend
│   ├── EventMarkers.tsx      ← Map markers
│   ├── SubscriptionPanel.tsx ← Subscription list
│   ├── types.ts              ← Type definitions
│   └── eventDatabase.ts      ← Legacy localStorage (backup)
├── package.json
└── vite.config.ts
```

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - Create new account
- `POST /auth/login` - Email-based login
- `POST /auth/login-username` - Username-based login (for frontend)

### Events
- `GET /events` - Get all events
- `GET /events/:id` - Get single event
- `POST /events` - Create event (auth required)
- `PUT /events/:id` - Update event (creator only)
- `DELETE /events/:id` - Delete event (creator only)
- `POST /events/:id/join` - Join event (auth required)
- `POST /events/:id/leave` - Leave event (auth required)

### Users
- `GET /users` - List all users
- `GET /users/me` - Get current user (auth required)
- `PUT /users/me` - Update profile (auth required)
- `GET /users/me/friends` - List friends (auth required)
- `POST /users/me/friends/:friendId` - Add friend (auth required)
- `DELETE /users/me/friends/:friendId` - Remove friend (auth required)

### Health
- `GET /health` - Server status

## 🧪 Testing the API

### Test Backend Health
```bash
curl http://localhost:3000/health
```
Response: `{"ok":true,"message":"Backend is running"}`

### Test Get Events
```bash
curl http://localhost:3000/events
```

### Test Login
```bash
curl -X POST http://localhost:3000/auth/login-username \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"alice123"}'
```

### Test Create Event (with token)
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "New Event",
    "description": "Test event",
    "lat": 41.3851,
    "lng": 2.1734,
    "event_time": "2024-05-07T10:00:00Z",
    "capacity": 20
  }'
```

## 🔗 Frontend → Backend Connection

### 1. API Client (src/api.ts)
The frontend uses an HTTP client that communicates with the backend:

```typescript
export async function fetchEvents() {
  const response = await fetch(`http://localhost:3000/events`)
  return await response.json()
}

export async function loginWithUsername(username: string, password: string) {
  const response = await fetch(`http://localhost:3000/auth/login-username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await response.json()
  setAuthToken(data.token)  // Store token for future requests
  return data
}
```

### 2. Token Management
- Login endpoint returns JWT token
- Token is stored in `localStorage` and request headers
- Token sent in `Authorization: Bearer {token}` header
- Token expires after 7 days

### 3. Data Flow Example: Creating an Event

```
1. User clicks map → handleSaveMarker()
   ↓
2. Calls createEvent(event) from api.ts
   ↓
3. api.ts sends POST http://localhost:3000/events
   - Includes Authorization header with JWT token
   ↓
4. Backend receives request in routes/events.ts
   ↓
5. Middleware auth.ts verifies token → extracts userId
   ↓
6. Event inserted into Supabase with creator_id = userId
   ↓
7. Backend returns event object to frontend
   ↓
8. Frontend adds event to map
   ↓
9. User sees new marker on map
```

## ⚠️ Troubleshooting

### Backend won't start: "Cannot find module"
```powershell
# Reinstall dependencies
cd backend
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Port 3000 already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### Frontend can't connect to backend
**Check:**
1. Is backend running on http://localhost:3000?
2. Browser console (F12) for error messages
3. Network tab to see API requests
4. CORS is enabled in backend (src/index.ts)

### Authentication errors
**Error:** `Invalid username or password`
- User may not exist in Supabase
- Check users table in Supabase dashboard
- Verify password hash with bcrypt comparison

**Error:** `Token expired or invalid`
- Refresh the page and login again
- Token expires after 7 days
- Check browser localStorage for authToken

### Event data not showing
1. Not logged in? Events can be read without login
2. Check Network tab - is `/events` request successful?
3. Check browser console for errors
4. Verify Supabase events table has data

## 📊 Data Persistence

**Backend uses Supabase (PostgreSQL):**
- Users table with authentication
- Events table with creator relationships
- Event participants table for subscriptions
- Data persists across app restarts

**Frontend (api.ts):**
- Fetches data from backend on load
- Updates local state
- Syncs back to backend on mutations

## 🔄 Typical User Journey

```
1. App loads → fetches events/users from API
2. User sees map with events
3. Click "Login" → enter username/password
4. Login request to backend → receives JWT
5. Click on map to create event → POST to backend
6. Click subscribe → POST to /join endpoint
7. View subscriptions in panel
8. Click delete → DELETE to backend (if creator)
9. Logout → clears token
```

## 🚀 Deployment Checklist

- [ ] Change JWT_SECRET to secure random value
- [ ] Use environment variables (not hardcoded)
- [ ] Set up real PostgreSQL database (Supabase)
- [ ] Enable HTTPS on production
- [ ] Configure CORS for production domain
- [ ] Add rate limiting to API
- [ ] Add input validation (already done with Zod)
- [ ] Hash passwords with bcrypt (already done)
- [ ] Add error monitoring (Sentry, etc.)
- [ ] Set up CI/CD pipeline

## 📚 Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com)
- [React Docs](https://react.dev)
- [React Leaflet](https://react-leaflet.js.org)
- [JWT.io](https://jwt.io)

## 🆘 Still Having Issues?

1. Check console logs in browser (F12)
2. Check terminal output for backend errors
3. Check Supabase dashboard - is data there?
4. Verify .env file has correct credentials
5. Try clearing localStorage: `localStorage.clear()` in console

---

**Last Updated:** May 2024
**Version:** 1.0.0
