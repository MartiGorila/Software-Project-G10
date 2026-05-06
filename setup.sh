#!/bin/bash

echo "🚀 Configurando Event App..."

# Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
cd Project
npm install
cd ..

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd backend
npm install
cd ..

echo "✅ Setup completado!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Backend: cd backend && npm run dev"
echo "2. Frontend: cd Project && npm run dev"
echo ""
echo "🌐 URLs:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: https://localhost:3001/api"
