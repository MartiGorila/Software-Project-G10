# PowerShell script to start both servers

Write-Host "🚀 Starting Event App (Backend + Frontend)" -ForegroundColor Green
Write-Host ""

# Check Node.js
if ($null -eq (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

# Backend dependencies
if (-not (Test-Path "backend/node_modules")) {
    Write-Host "Installing backend dependencies..."
    Push-Location backend
    npm install
    Pop-Location
}

# Frontend dependencies
if (-not (Test-Path "Project/node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location Project  
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "✅ Dependencies ready" -ForegroundColor Green
Write-Host ""

# Start backend in new window
Write-Host "🔧 Starting Backend on http://localhost:3000" -ForegroundColor Yellow
Start-Process pwsh -ArgumentList {
    Set-Location $PSScriptRoot
    cd backend
    npm run dev
} 

# Wait for backend
Start-Sleep -Seconds 2

# Start frontend in new window  
Write-Host "🌐 Starting Frontend on http://localhost:5173" -ForegroundColor Yellow
Start-Process pwsh -ArgumentList {
    Set-Location $PSScriptRoot
    cd Project
    npm run dev
}

Write-Host ""
Write-Host "✅ Both servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Open in browser: http://localhost:5173" -ForegroundColor Yellow
Write-Host "📝 Default credentials: alice/alice123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
