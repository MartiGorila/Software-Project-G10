import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import authRouter from './routes/auth.js'
import eventsRouter from './routes/events.js'
import plansRouter from './routes/plans.js'
import usersRouter from './routes/users.js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const app = express()
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)

    // Allow localhost on any port during development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true)
    }

    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Backend is running' })
})

const PORT = process.env.PORT ?? 3000
app.use('/auth', authRouter)
app.use('/events', eventsRouter)
app.use('/plans', plansRouter)
app.use('/users', usersRouter)

// Error handler - catch all errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Server Error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: err?.message || 'Something went wrong',
  })
})

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint does not exist',
  })
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(`📡 Frontend CORS enabled for localhost (any port)`)
  console.log(`📚 API Routes: /auth, /events, /plans, /users`)
})