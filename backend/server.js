import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initializeDatabase, getUsers, getEvents, addEvent, deleteEvent, subscribeUser, unsubscribeUser } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(bodyParser.json())

// Initialize database
initializeDatabase()

// Routes
app.get('/api/users', (req, res) => {
    try {
        const users = getUsers()
        res.json(users)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.get('/api/events', (req, res) => {
    try {
        const events = getEvents()
        res.json(events)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/api/events', (req, res) => {
    try {
        const { name, hour, description, position, creatorId } = req.body
        const event = addEvent(name, hour, description, position, creatorId)
        res.json(event)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.delete('/api/events/:id', (req, res) => {
    try {
        deleteEvent(req.params.id)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/api/subscribe', (req, res) => {
    try {
        const { userId, eventId } = req.body
        subscribeUser(userId, eventId)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.post('/api/unsubscribe', (req, res) => {
    try {
        const { userId, eventId } = req.body
        unsubscribeUser(userId, eventId)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' })
})

// SSL/HTTPS configuration
const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
}

https.createServer(options, app).listen(PORT, () => {
    console.log(`✅ HTTPS Server running on https://localhost:${PORT}`)
})
