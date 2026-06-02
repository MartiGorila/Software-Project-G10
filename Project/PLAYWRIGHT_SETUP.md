# Playwright UI Tests Setup Guide

## ⚠️ Prerequisites

Before running tests, you **MUST** start both the backend and frontend:

### Terminal 1 - Start Backend
```bash
cd backend
npm run dev
```
This should start on `http://localhost:3000` and show: `Server running on port 3000`

### Terminal 2 - Start Frontend (Dev Server)
```bash
cd Project
npm run dev
```
This should start on `http://localhost:5173`

**Tests will FAIL if the backend is not running!**

## What was installed

- **@playwright/test** - Playwright testing framework for modern web apps

## Project Structure

```
Project/
├── playwright.config.ts        # Playwright configuration
├── tests/
│   ├── fixtures.ts             # Test utilities and API helpers
│   └── example.spec.ts         # Example UI tests
└── package.json                # Updated with test scripts
```

## Available Test Commands

```bash
# Run all tests in headless mode (recommended for CI)
npm test

# Run tests with UI mode (interactive)
npm run test:ui

# Run tests with browser visible
npm run test:headed

# Debug tests with Playwright Inspector
npm run test:debug
```

## Configuration Details

- **Base URL (Frontend)**: http://localhost:5173 (your Vite dev server)
- **API Base (Backend)**: http://localhost:3000 (your Node.js backend)
- **Browsers**: Chrome, Firefox, Safari
- **Auto-start**: Config attempts to start both dev servers automatically
- **Reports**: HTML report generated in `playwright-report/` directory
- **Screenshots**: Captured on test failures in `test-results/`

## Running Tests

### Option 1: Run All Tests
```bash
npm test
```

### Option 2: Run Tests with UI (Recommended for Development)
```bash
npm run test:ui
```
This opens an interactive test runner where you can:
- See test execution in real-time
- Click to run individual tests
- View test outcomes
- Watch mode available

### Option 3: Run Tests in Headed Mode
```bash
npm run test:headed
```
Browser windows will be visible during test execution.

### Option 4: Debug Tests
```bash
npm run test:debug
```
Opens Playwright Inspector for step-by-step debugging.

## Understanding the Tests

The example tests in `tests/example.spec.ts` include:

1. **Page Load Test** - Verifies the map and login button load
2. **Sidebar Test** - Checks if sidebar elements are visible
3. **Login Form Test** - Tests login form visibility toggle
4. **Map Markers Test** - Verifies map markers are rendered
5. **Legend Test** - Checks legend display
6. **Form Toggle Test** - Tests switching between login and register
7. **Tab Navigation** - Tests switching between login/register tabs
8. **User Registration** - Tests creating a new user account

## Troubleshooting

### ❌ Tests fail immediately with "ECONNREFUSED"

**Problem:** Backend is not running

**Solution:**
```bash
# Terminal 1
cd backend
npm run dev

# Wait for: "Server running on port 3000"
# Then in another terminal:

# Terminal 2
cd Project
npm run test:ui
```

### ❌ "Backend did not become ready within timeout"

**Problem:** Backend is taking too long to start or failed to start

**Checklist:**
1. Check if backend terminal shows `Server running on port 3000`
2. Manually test: `curl http://localhost:3000/health`
3. Check `.env` file in backend folder has valid Supabase credentials
4. Restart backend: `npm run dev`

### ❌ Tests hang or timeout

**Problem:** Something is blocking the tests

**Solutions:**
1. Check if Vite dev server is running: `npm run dev` from Project folder
2. Ensure port 5173 is available: `lsof -i :5173` (mac) or `netstat -ano | findstr :5173` (windows)
3. Try single browser: `npx playwright test --project=chromium`

### ❌ "Element not found" errors

**Problem:** Element is not visible or page hasn't loaded

**Solutions:**
1. Increase timeout in tests: `{ timeout: 15000 }`
2. Add explicit waits: `await page.waitForSelector('.element')`
3. Use `npm run test:ui` to inspect what's happening
4. Check browser console for JavaScript errors

### ✅ Quick Verification Checklist

Before running tests:
- [ ] Backend running: `curl http://localhost:3000/health` → `{"ok":true}`
- [ ] Frontend dev server running: Visit `http://localhost:5173` in browser
- [ ] Node.js version ≥ 18: `node --version`
- [ ] Playwright installed: `npx playwright --version`

## Test Structure

### Using Fixtures

```typescript
test('should do something', async ({ page, authenticatedUser }) => {
    // authenticatedUser is automatically created and cleaned up
    // It has: username, email, password, userId, token
})
```

### Common Locator Strategies

```typescript
// By text
page.locator('text=Hello')

// By role
page.locator('role=button')

// By CSS class
page.locator('.class-name')

// By ID
page.locator('#element-id')

// By attribute
page.locator('[data-testid="value"]')

// Combined
page.locator('button:has-text("Submit")')
```

### API Helpers

```typescript
import { waitForBackend, loginUser } from './fixtures'

// Wait for backend to be ready
await waitForBackend(timeout)

// Login a user
await loginUser(page, user)
```

## Viewing Test Results

After running tests, view the HTML report:
```bash
npx playwright show-report
```

## Writing New Tests

Basic structure:
```typescript
import { test, expect } from './fixtures'

test.describe('Feature Name', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/')
        await page.waitForSelector('.element-to-load')
    })

    test('should do something', async ({ page }) => {
        const button = page.locator('button:has-text("Click")')
        await button.click()
        
        await expect(page.locator('.result')).toBeVisible()
    })

    test('should test authenticated flow', async ({ page, authenticatedUser }) => {
        // Login happens automatically via fixture
        // User is in authenticatedUser object
    })
})
```

## Next Steps

1. ✅ Start both backend and frontend
2. ✅ Run: `npm run test:ui`
3. ✅ Watch tests execute
4. ✅ Create more tests for your features

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Locators Guide](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
