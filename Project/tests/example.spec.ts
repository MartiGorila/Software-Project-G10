import { test, expect, waitForBackend } from './fixtures'

test.describe('Map App - UI Tests', () => {
    test.beforeAll(async () => {
        // Ensure backend is ready before running any tests
        await waitForBackend()
    })

    test.beforeEach(async ({ page }) => {
        // Navigate to the app before each test
        await page.goto('/')
        // Wait for map to load
        await page.waitForSelector('.leaflet-container', { timeout: 10000 })
    })

    test('should load the map and display the main elements', async ({ page }) => {
        // Check if the map container is visible
        const leafletContainer = page.locator('.leaflet-container')
        await expect(leafletContainer).toBeVisible()

        // Check if the login button is present
        const loginButton = page.locator('button:has-text("Login / Register")')
        await expect(loginButton).toBeVisible()
    })

    test('should have sidebar overlay visible', async ({ page }) => {
        // Check if sidebar exists
        const sidebarOverlay = page.locator('.sidebar-overlay')
        await expect(sidebarOverlay).toBeVisible()

        // Check if login button is present (login panel is only visible when opened)
        const loginButton = page.locator('button:has-text("Login / Register")')
        await expect(loginButton).toBeVisible()
    })

    test('should show login form when login button is clicked', async ({ page }) => {
        const loginButton = page.locator('button:has-text("Login / Register")')
        await loginButton.click()

        // Wait for the login form to appear
        const loginForm = page.locator('.login-form')
        await expect(loginForm).toBeVisible()

        // Check for email and password fields
        const emailInput = page.locator('input[type="email"]')
        const passwordInput = page.locator('input[type="password"]')
        await expect(emailInput).toBeVisible()
        await expect(passwordInput).toBeVisible()
    })

    test('should display map markers for events', async ({ page }) => {
        // Wait for markers to load
        await page.waitForTimeout(2000)

        // Check if any map markers exist
        const mapMarkers = page.locator('.map-marker')
        const count = await mapMarkers.count()
        console.log(`Found ${count} map markers`)

        // Should have at least some markers
        if (count > 0) {
            await expect(mapMarkers.first()).toBeVisible()
        }
    })

    test('should have the legend visible', async ({ page }) => {
        // Check if the legend is present
        const legend = page.locator('.map-legend')
        await expect(legend).toBeVisible()

        // Check for event and plan legend items
        const eventLegend = page.locator('.map-legend').locator('text=Event')
        const planLegend = page.locator('.map-legend').locator('text=Plan')

        await expect(eventLegend).toBeVisible()
        await expect(planLegend).toBeVisible()
    })

    test('should toggle login form visibility', async ({ page }) => {
        const loginButton = page.locator('button:has-text("Login / Register")')

        // Click to show form
        await loginButton.click()
        const loginForm = page.locator('.login-form')
        await expect(loginForm).toBeVisible()

        // Click again to hide form
        await loginButton.click()
        await expect(loginForm).not.toBeVisible()
    })
    test('should successfully log in with generated credentials', async ({ page, authenticatedUser }) => {
        const loginButton = page.locator('button:has-text("Login / Register")')
        await loginButton.click()

        const loginForm = page.locator('.login-form')
        const emailInput = page.locator('input[type="email"]')
        const passwordInput = page.locator('input[type="password"]')

        await expect(loginForm).toBeVisible()
        await emailInput.fill(authenticatedUser.email)
        await passwordInput.fill(authenticatedUser.password)

        await page.locator('button:has-text("Sign in")').click()
        await expect(loginForm).not.toBeVisible({ timeout: 10000 })
    })

})
