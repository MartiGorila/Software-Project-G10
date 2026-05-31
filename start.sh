#!/bin/bash

# Bash script to start both backend and frontend servers

echo "🚀 Starting Event App (Backend + Frontend)"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node.js $NODE_VERSION is installed"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Install backend dependencies if needed
if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd "$SCRIPT_DIR/backend"
    npm install
    cd "$SCRIPT_DIR"
    echo "✓ Backend dependencies installed"
fi

# Install frontend dependencies if needed
if [ ! -d "$SCRIPT_DIR/Project/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd "$SCRIPT_DIR/Project"
    npm install
    cd "$SCRIPT_DIR"
    echo "✓ Frontend dependencies installed"
fi

echo ""
echo "🔧 Starting servers..."
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start backend server
echo "Starting backend..."
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "Starting frontend..."
cd "$SCRIPT_DIR/Project"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are running"
echo ""

# Handle Ctrl+C to stop both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

# Wait for both processes
wait
