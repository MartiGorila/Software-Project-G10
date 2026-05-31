# PowerShell script to start both backend and frontend servers

Write-Host "🚀 Starting Event App (Backend + Frontend)" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
$nodeCheck = node --version 2>$null
if (-not $nodeCheck) {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Node.js $nodeCheck is installed" -ForegroundColor Green
Write-Host ""

# Install backend dependencies if needed
if (-not (Test-Path "backend/node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
    Write-Host "✓ Backend dependencies installed" -ForegroundColor Green
}

# Install frontend dependencies if needed
if (-not (Test-Path "Project/node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location Project
    npm install
    Pop-Location
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔧 Starting servers..." -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow
Write-Host ""

# Start backend server in a new terminal window
Write-Host "Starting backend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$((Get-Location).Path)\backend'; npm run dev"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend server in a new terminal window
Write-Host "Starting frontend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$((Get-Location).Path)\Project'; npm run dev"

Write-Host ""
Write-Host "✅ Both servers are starting in separate terminal windows" -ForegroundColor Green
