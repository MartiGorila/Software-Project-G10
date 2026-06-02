#!/usr/bin/env bash

# Test setup and troubleshooting script

set -e

echo "🔍 Checking Playwright test environment..."
echo ""

# Check Node.js
echo "✓ Node.js:"
node --version
echo ""

# Check npm
echo "✓ npm:"
npm --version
echo ""

# Check Playwright
echo "✓ Playwright:"
npx playwright --version
echo ""

# Check if backend is accessible
echo "🔗 Checking backend connection..."
BACKEND_URL="${API_BASE:-http://localhost:3000}"
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "✓ Backend is running on $BACKEND_URL"
else
    echo "✗ Backend NOT running on $BACKEND_URL"
    echo "  Start the backend with: cd backend && npm run dev"
fi
echo ""

# Check if frontend dev server is running
echo "🔗 Checking frontend dev server..."
UI_URL="${UI_BASE:-http://localhost:5173}"
if curl -s "$UI_URL" > /dev/null 2>&1; then
    echo "✓ Frontend dev server is running on $UI_URL"
else
    echo "✗ Frontend dev server NOT running on $UI_URL"
    echo "  Start it with: npm run dev"
fi
echo ""

# Show how to run tests
echo "📝 To run tests:"
echo ""
echo "  npm test              # Run all tests"
echo "  npm run test:ui       # Interactive test runner"
echo "  npm run test:headed   # See browser while testing"
echo "  npm run test:debug    # Debug mode with inspector"
echo ""

echo "ℹ️  Environment:"
echo "  API_BASE: $BACKEND_URL"
echo "  UI_BASE: $UI_URL"
echo ""

echo "✅ Setup check complete!"
