import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import authRouter from './routes/auth'
import eventsRouter from './routes/events'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

const PORT = process.env.PORT ?? 3000
app.use('/auth', authRouter)
app.use('/events', eventsRouter)
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})