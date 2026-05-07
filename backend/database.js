import sqlite3 from 'sqlite3'
import { randomUUID } from 'crypto'

const db = new sqlite3.Database('./events.db')

export function initializeDatabase() {
    db.serialize(() => {
        // Tabla de usuarios
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `)

        // Tabla de eventos
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                hour TEXT NOT NULL,
                description TEXT,
                position TEXT NOT NULL,
                creatorId TEXT NOT NULL,
                FOREIGN KEY (creatorId) REFERENCES users(id)
            )
        `)

        // Tabla de suscripciones
        db.run(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                userId TEXT NOT NULL,
                eventId TEXT NOT NULL,
                PRIMARY KEY (userId, eventId),
                FOREIGN KEY (userId) REFERENCES users(id),
                FOREIGN KEY (eventId) REFERENCES events(id)
            )
        `)

        // Insertar datos de prueba
        const defaultUsers = [
            { id: 'user-1', username: 'alice', password: 'alice123' },
            { id: 'user-2', username: 'bob', password: 'bob123' },
            { id: 'user-3', username: 'carol', password: 'carol123' },
            { id: 'user-4', username: 'dave', password: 'dave123' },
            { id: 'user-5', username: 'eve', password: 'eve123' },
        ]

        const defaultEvents = [
            {
                id: 'event-1',
                name: 'Morning Plaza Meetup',
                hour: '08:30',
                description: 'Start the day with a group meetup at the plaza.',
                position: JSON.stringify([41.381, 2.168]),
                creatorId: 'user-1'
            },
            {
                id: 'event-2',
                name: 'Cafe Networking',
                hour: '10:00',
                description: 'Coffee and networking session near the route.',
                position: JSON.stringify([41.383, 2.170]),
                creatorId: 'user-2'
            },
            {
                id: 'event-3',
                name: 'Lunch Break',
                hour: '12:30',
                description: 'Lunch break with friends and partners.',
                position: JSON.stringify([41.386, 2.173]),
                creatorId: 'user-3'
            },
            {
                id: 'event-4',
                name: 'Afternoon Workshop',
                hour: '15:00',
                description: 'A short workshop on route planning and transit.',
                position: JSON.stringify([41.389, 2.175]),
                creatorId: 'user-4'
            },
            {
                id: 'event-5',
                name: 'Evening Wrap-up',
                hour: '17:30',
                description: 'Finish the day with a summary and next steps.',
                position: JSON.stringify([41.391, 2.178]),
                creatorId: 'user-5'
            },
        ]

        // Insertar usuarios
        defaultUsers.forEach((user) => {
            db.run(
                `INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)`,
                [user.id, user.username, user.password]
            )
        })

        // Insertar eventos
        defaultEvents.forEach((event) => {
            db.run(
                `INSERT OR IGNORE INTO events (id, name, hour, description, position, creatorId) VALUES (?, ?, ?, ?, ?, ?)`,
                [event.id, event.name, event.hour, event.description, event.position, event.creatorId]
            )
        })

        // Insertar suscripciones de prueba
        const subscriptions = [
            { userId: 'user-1', eventId: 'event-1' },
            { userId: 'user-1', eventId: 'event-3' },
            { userId: 'user-2', eventId: 'event-2' },
            { userId: 'user-3', eventId: 'event-3' },
            { userId: 'user-3', eventId: 'event-4' },
            { userId: 'user-4', eventId: 'event-1' },
            { userId: 'user-4', eventId: 'event-5' },
            { userId: 'user-5', eventId: 'event-2' },
            { userId: 'user-5', eventId: 'event-4' },
            { userId: 'user-5', eventId: 'event-5' },
        ]

        subscriptions.forEach(({ userId, eventId }) => {
            db.run(
                `INSERT OR IGNORE INTO subscriptions (userId, eventId) VALUES (?, ?)`,
                [userId, eventId]
            )
        })
    })
}

export function getUsers() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT u.id, u.username, u.password,
                    GROUP_CONCAT(s.eventId) as subscriptions
             FROM users u
             LEFT JOIN subscriptions s ON u.id = s.userId
             GROUP BY u.id`,
            (err, rows) => {
                if (err) reject(err)
                const users = rows.map((row) => ({
                    id: row.id,
                    username: row.username,
                    password: row.password,
                    subscriptions: row.subscriptions ? row.subscriptions.split(',') : [],
                }))
                resolve(users)
            }
        )
    })
}

export function getEvents() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT e.*,
                    GROUP_CONCAT(s.userId) as subscribers
             FROM events e
             LEFT JOIN subscriptions s ON e.id = s.eventId
             GROUP BY e.id`,
            (err, rows) => {
                if (err) reject(err)
                const events = rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    hour: row.hour,
                    description: row.description,
                    position: JSON.parse(row.position),
                    creatorId: row.creatorId,
                    subscribers: row.subscribers ? row.subscribers.split(',') : [],
                }))
                resolve(events)
            }
        )
    })
}

export function addEvent(name, hour, description, position, creatorId) {
    return new Promise((resolve, reject) => {
        const id = Date.now().toString()
        db.run(
            `INSERT INTO events (id, name, hour, description, position, creatorId) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, hour, description, JSON.stringify(position), creatorId],
            (err) => {
                if (err) reject(err)
                resolve({ id, name, hour, description, position, creatorId })
            }
        )
    })
}

export function deleteEvent(eventId) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM events WHERE id = ?`, [eventId], (err) => {
            if (err) reject(err)
            resolve()
        })
    })
}

export function subscribeUser(userId, eventId) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR IGNORE INTO subscriptions (userId, eventId) VALUES (?, ?)`,
            [userId, eventId],
            (err) => {
                if (err) reject(err)
                resolve()
            }
        )
    })
}

export function unsubscribeUser(userId, eventId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM subscriptions WHERE userId = ? AND eventId = ?`,
            [userId, eventId],
            (err) => {
                if (err) reject(err)
                resolve()
            }
        )
    })
}
