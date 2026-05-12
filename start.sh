#!/bin/bash

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Event App (Backend + Frontend)${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"

# Backend
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    (cd backend && npm install)
fi

# Frontend
if [ ! -d "Project/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd Project && npm install)
fi

echo ""
echo -e "${GREEN}✅ Dependencies ready${NC}"
echo ""

# Start backend
echo -e "${YELLOW}🔧 Starting Backend on http://localhost:3000${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 2

# Start frontend
echo -e "${YELLOW}🌐 Starting Frontend on http://localhost:5173${NC}"
(cd Project && npm run dev) &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Both servers started!${NC}"
echo ""
echo -e "${YELLOW}📋 Open in browser:${NC} ${GREEN}http://localhost:5173${NC}"
echo -e "${YELLOW}📝 Default credentials: alice/alice123${NC}"
echo ""

wait
