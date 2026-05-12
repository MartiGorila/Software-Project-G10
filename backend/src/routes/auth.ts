import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { supabase } from '../index.js'

const router = Router()

const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const LoginUsernameSchema = z.object({
  username: z.string().min(3),
  password: z.string(),
})

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { username, email, password } = parsed.data

    const password_hash = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
      .from('users')
      .insert({ username, email, password_hash })
      .select('id, username, email, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Username or email already taken' })
        return
      }
      res.status(500).json({ error: 'Failed to register user', message: error.message })
      return
    }

    const token = jwt.sign(
      { userId: data.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    res.status(201).json({ user: data, token })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { email, password } = parsed.data

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, password_hash, created_at')
      .eq('email', email)
      .single()

    if (error || !user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const { password_hash: _, ...safeUser } = user
    res.json({ user: safeUser, token })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// POST /auth/login-username (for frontend compatibility)
router.post('/login-username', async (req: Request, res: Response) => {
  try {
    const parsed = LoginUsernameSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { username, password } = parsed.data

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, password_hash, created_at')
      .eq('username', username)
      .single()

    if (error || !user) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' })
      return
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    const { password_hash: _, ...safeUser } = user
    res.json({ user: safeUser, token })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

export default router