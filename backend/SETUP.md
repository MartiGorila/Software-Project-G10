# Backend Setup Guide

This guide explains how to set up and run the backend locally after cloning the repository.

---

# 1. Requirements

Install the following before starting:

* Node.js
* npm
* Git

Recommended versions:

```txt
Node.js >= 18
npm >= 9
```

To verify installation:

```bash
node -v
npm -v
git --version
```

---

# 2. Clone the Repository

```bash
git clone <REPOSITORY_URL>
cd Software-Project-G10
```

---

# 3. Backend Folder

Move into the backend folder:

```bash
cd backend
```

---

# 4. Install Dependencies

Run:

```bash
npm install
```

This installs:

* Express
* TypeScript
* Supabase client
* bcrypt
* JWT
* Zod
* ts-node
* nodemon
* other backend dependencies

---

# 5. Create the Environment File

The backend requires a `.env` file.

Create it:

```bash
touch .env
```

Inside `.env`, add:

```env
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET=YOUR_JWT_SECRET
PORT=3000
```

Ask a team member for the real values.

---

# 6. Important Notes About `.env`

The `.env` file:

* contains secrets
* must NEVER be committed to Git
* is already ignored through `.gitignore`

Only `.env.example` should be committed.

---

# 7. Start the Backend

Run:

```bash
npm run dev
```

Expected output:

```txt
Server running on port 3000
```

Backend URL:

```txt
http://localhost:3000
```

---

# 8. Health Check

Open another terminal and run:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"ok":true}
```

If this works, the backend is running correctly.

---

# 9. Main API Routes

## Auth

```txt
POST /auth/register
POST /auth/login
```

---

## Events

```txt
GET /events
GET /events/:id
POST /events
PUT /events/:id
DELETE /events/:id
POST /events/:id/join
DELETE /events/:id/join
```

---

## Plans

```txt
GET /plans
GET /plans/:id
POST /plans
PUT /plans/:id
DELETE /plans/:id
```

---

## Users

```txt
GET /users/me
PUT /users/me
GET /users/:id
GET /users/me/friends
POST /users/me/friends/:friendId
DELETE /users/me/friends/:friendId
```

---

# 10. Authentication

Protected routes require a JWT token.

After login/register, the backend returns:

```json
{
  "user": {
    "id": "...",
    "username": "...",
    "email": "..."
  },
  "token": "..."
}
```

Use the token like this:

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

# 11. Example User Registration

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

# 12. Common Problems

## Backend does not start

Check:

* `.env` exists
* dependencies installed
* correct Node version

---

## Supabase connection errors

Verify:

* `SUPABASE_URL`
* `SUPABASE_SERVICE_KEY`

Make sure the service role key is used.

---

## JWT errors / Unauthorized

Log in again and use a fresh token.

---

## Port already in use

Change:

```env
PORT=3001
```

or stop the process using port 3000.

---

# 13. Frontend Setup

Frontend is located in:

```txt
/Project
```

Run frontend separately:

```bash
cd ../Project
npm install
npm run dev
```

Frontend URL:

```txt
http://localhost:5173
```

Backend URL:

```txt
http://localhost:3000
```

Both servers must run simultaneously during development.

---

# 14. Recommended Workflow

Before starting work:

```bash
git pull
```

After changes:

```bash
git add .
git commit -m "your message"
git push
```

Always pull before starting new work to avoid merge conflicts.
