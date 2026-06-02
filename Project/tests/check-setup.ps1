#!/usr/bin/env pwsh

# Playwright test setup verification script for Windows PowerShell

Write-Host "🔍 Checking Playwright test environment..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "✓ Node.js:" -ForegroundColor Green
node --version
Write-Host ""

# Check npm
Write-Host "✓ npm:" -ForegroundColor Green
npm --version
Write-Host ""

# Check if Playwright is installed
Write-Host "✓ Checking Playwright installation..." -ForegroundColor Green
if (Get-Command npx -ErrorAction SilentlyContinue) {
    $playwrightVersion = npx playwright --version 2>&1
    if ($?) {
        Write-Host "✓ Playwright: $playwrightVersion" -ForegroundColor Green
    } else {
        Write-Host "✗ Playwright not found. Run: npm install -D @playwright/test" -ForegroundColor Red
    }
} else {
    Write-Host "✗ npm/npx not found" -ForegroundColor Red
}
Write-Host ""

# Check if backend is accessible
Write-Host "🔗 Checking backend connection..." -ForegroundColor Cyan
$backendUrl = "http://localhost:3000"
$backendHealth = "$backendUrl/health"

try {
    $response = Invoke-WebRequest -Uri $backendHealth -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend is running on $backendUrl" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Backend NOT running on $backendUrl" -ForegroundColor Red
    Write-Host "  Start the backend with: cd backend; npm run dev" -ForegroundColor Yellow
}
Write-Host ""

# Check if frontend dev server is running
Write-Host "🔗 Checking frontend dev server..." -ForegroundColor Cyan
$uiUrl = "http://localhost:5173"

try {
    $response = Invoke-WebRequest -Uri $uiUrl -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Frontend dev server is running on $uiUrl" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend dev server NOT running on $uiUrl" -ForegroundColor Red
    Write-Host "  Start it with: npm run dev (from Project folder)" -ForegroundColor Yellow
}
Write-Host ""

# Show how to run tests
Write-Host "📝 To run tests:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  npm test              # Run all tests" -ForegroundColor White
Write-Host "  npm run test:ui       # Interactive test runner" -ForegroundColor White
Write-Host "  npm run test:headed   # See browser while testing" -ForegroundColor White
Write-Host "  npm run test:debug    # Debug mode with inspector" -ForegroundColor White
Write-Host ""

Write-Host "ℹ️  Environment:" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:3000" -ForegroundColor White
Write-Host "  Frontend URL: http://localhost:5173" -ForegroundColor White
Write-Host ""

Write-Host "✅ Setup check complete!" -ForegroundColor Green
