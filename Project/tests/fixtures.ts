import { test as base, expect } from '@playwright/test'

const API_BASE = process.env.API_BASE || 'http://localhost:3000'

interface TestUser {
    username: string
    email: string
    password: string
    userId?: string
    token?: string
}

// Extend test fixture with auth utilities
export const test = base.extend<{ authenticatedUser: TestUser }>({
    authenticatedUser: async ({ }, use) => {
        const user: TestUser = {
            username: `testuser_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            password: 'TestPass123!',
        }

        try {
            // Register user
            const registerRes = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user.username,
                    email: user.email,
                    password: user.password,
                }),
            })

            if (!registerRes.ok) {
                const errorText = await registerRes.text()
                throw new Error(`Registration failed (${registerRes.status}): ${errorText}`)
            }

            const registerData = await registerRes.json()
            user.userId = registerData.user.id
            user.token = registerData.token

            console.log(`✓ Test user created: ${user.username}`)
        } catch (error) {
            console.error('Failed to create test user:', error)
            throw error
        }

        // Pass user to test
        await use(user)

        // Cleanup after test
        try {
            if (user.token) {
                await fetch(`${API_BASE}/auth/delete-account`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${user.token}`,
                    },
                })
                console.log(`✓ Test user deleted: ${user.username}`)
            }
        } catch (error) {
            console.warn('Failed to cleanup test user:', error)
        }
    },
})

// Helper function to wait for backend
export async function waitForBackend(timeout = 60000) {
    console.log(`⏳ Waiting for backend at ${API_BASE}...`)
    const startTime = Date.now()
    let lastError = ''

    while (Date.now() - startTime < timeout) {
        try {
            const res = await fetch(`${API_BASE}/health`, { method: 'GET' })
            if (res.ok) {
                console.log('✓ Backend is ready')
                return true
            }
        } catch (error) {
            lastError = String(error)
            // Retry
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error(
        `Backend did not become ready within ${timeout}ms. Last error: ${lastError}\n` +
        `Make sure the backend is running: cd backend && npm run dev`,
    )
}

// Helper to login via API and store auth
export async function loginUser(page: any, user: TestUser) {
    try {
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                password: user.password,
            }),
        })

        if (!loginRes.ok) {
            const errorText = await loginRes.text()
            throw new Error(`Login failed (${loginRes.status}): ${errorText}`)
        }

        const loginData = await loginRes.json()
        user.token = loginData.token

        // Store token in localStorage via page
        await page.evaluate(
            (token: string) => {
                localStorage.setItem('token', token)
            },
            user.token,
        )

        console.log(`✓ User logged in: ${user.username}`)
    } catch (error) {
        console.error('Failed to login user:', error)
        throw error
    }
}

export { expect }
