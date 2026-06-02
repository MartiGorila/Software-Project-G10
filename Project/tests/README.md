# 🚀 Quick Start: Running Playwright Tests

## ⚠️ IMPORTANT: Backend Must Be Running

The tests will **immediately fail** if the backend is not initialized and running. Follow these steps:

## Step 1: Start the Backend

Open a **new terminal** and run:

```bash
cd backend
npm run dev
```

Wait for this message:
```
Server running on port 3000
```

✅ Backend is now ready for testing

## Step 2: Start the Frontend Dev Server

Open **another terminal** and run:

```bash
cd Project
npm run dev
```

Wait for Vite to start on port 5173.

## Step 3: Run the Tests

In a **third terminal** (or once dev servers are running), run:

```bash
cd Project
npm run test:ui
```

This opens an interactive test dashboard where you can:
- Watch tests execute
- Run individual tests
- See live results
- Inspect failures

## Alternative Commands

```bash
npm test              # Run all tests (headless)
npm run test:headed   # See browser while testing
npm run test:debug    # Debug with Playwright Inspector
```

## ❌ Troubleshooting

### "ECONNREFUSED" or "Backend is not ready"

**Backend is not running!**

```bash
# Terminal 1
cd backend
npm run dev
# Wait for: "Server running on port 3000"
```

### "Cannot find module 'process'"

Fixed ✅ - TypeScript types are now configured

### Tests hang or timeout

**Check both servers are running:**
- Backend on `http://localhost:3000` (Port 3000)
- Frontend on `http://localhost:5173` (Port 5173)

Try:
```bash
curl http://localhost:3000/health
# Should return: {"ok":true}
```

### "Element not found" errors

The page hasn't fully loaded. Tests now:
- Wait for map to load before starting
- Have proper timeouts configured
- Auto-retry on failures

## 📊 Test Features

The test suite includes:
- ✅ Page load verification
- ✅ UI element visibility checks
- ✅ Login/Register form tests
- ✅ User registration flow
- ✅ Automatic backend verification
- ✅ Automatic test user creation and cleanup

## 📝 What Tests Do

```
✓ Load the map and display main elements
✓ Display sidebar overlay
✓ Show login form when button clicked
✓ Display map markers for events
✓ Display the legend
✓ Toggle login form visibility
✓ Navigate between login and register tabs
✓ Register a new user
```

## 🔧 Key Files

```
Project/
├── playwright.config.ts     # Test configuration
├── tests/
│   ├── fixtures.ts          # API helpers and fixtures
│   ├── example.spec.ts      # Test examples
│   ├── check-setup.ps1      # Verification script
│   └── check-setup.sh       # Verification script
└── PLAYWRIGHT_SETUP.md      # Full documentation
```

## 📖 Next Steps

1. ✅ Ensure backend is running (`npm run dev` in backend folder)
2. ✅ Ensure frontend dev server is running (`npm run dev` in Project folder)
3. ✅ Run tests: `npm run test:ui`
4. ✅ View results in interactive dashboard

## 🎯 Common Tasks

**Run a single test:**
```bash
npx playwright test example.spec.ts -g "should load the map"
```

**Run in a specific browser:**
```bash
npx playwright test --project=chromium
```

**View test results:**
```bash
npx playwright show-report
```

**Debug a test:**
```bash
npm run test:debug
```

---

**Still having issues?** Check [PLAYWRIGHT_SETUP.md](./PLAYWRIGHT_SETUP.md) for detailed documentation.
