# Event App - Backend Setup

## Requisitos
- Node.js 18+
- npm

## Instalación

1. Navega a la carpeta del backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

## Ejecutar el servidor

Para desarrollo:
```bash
npm run dev
```

Para producción:
```bash
npm start
```

El servidor HTTPS correrá en `https://localhost:3001`

## Endpoints disponibles

### Usuarios
- `GET /api/users` - Obtiene todos los usuarios con sus suscripciones

### Eventos  
- `GET /api/events` - Obtiene todos los eventos
- `POST /api/events` - Crea un nuevo evento
- `DELETE /api/events/:id` - Elimina un evento

### Suscripciones
- `POST /api/subscribe` - Suscribe un usuario a un evento
- `POST /api/unsubscribe` - Desuscrribe un usuario de un evento

### Health Check
- `GET /health` - Verifica el estado del servidor

## Datos por defecto

El backend crea automáticamente:
- 5 usuarios: alice, bob, carol, dave, eve (contraseña = username + "123")
- 5 eventos distribuidos entre los usuarios
- Suscripciones iniciales según el plan

## SSL/HTTPS

El servidor usa certificados autofirmados en `backend/ssl/`. Para desarrollo está bien, pero en producción deberías usar certificados válidos.

El frontend actuará ignorando certificados autofirmados (permitido en desarrollo).
