# ONAMI Backend

API REST desarrollada con Node.js y Express para la aplicación ONAMI, una plataforma de gestión deportiva para entrenadores y atletas.

## Tecnologías

- Node.js
- Express 5
- PostgreSQL (pg)
- JSON Web Tokens (JWT)
- bcrypt
- dotenv
- cors

## Requisitos previos

- Node.js 18 o superior
- PostgreSQL instalado y en ejecución

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Tainy26/ONAMI-APP-BACKEND-V1.git
cd ONAMI-APP-BACKEND-V1

# Instalar dependencias
npm install

# Crear el archivo de variables de entorno
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```
PORT=3000
DB_USER=tu_usuario
DB_HOST=localhost
DB_DATABASE=onami_app
DB_PASSWORD=tu_contraseña
DB_PORT=5432
JWT_SECRET=tu_secreto
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

## Uso

```bash
# Iniciar el servidor
npm start
```

El servidor se iniciará en `http://localhost:3000`.

## Endpoints

| Método | Ruta | Descripción | Protegida |
|--------|------|-------------|-----------|
| GET | `/` | Estado de la API | No |
| POST | `/auth/register` | Registro de usuario | No |
| POST | `/auth/login` | Inicio de sesión | No |
| GET | `/auth/me` | Usuario autenticado | Sí |
| GET | `/athletes` | Listar atletas | Sí |
| GET | `/teams` | Listar equipos | Sí |
| POST | `/teams` | Crear equipo | Sí |
| GET | `/sessions` | Listar sesiones | Sí |
| POST | `/sessions` | Crear sesión | Sí |
| GET | `/daily-load` | Cargas diarias | Sí |
| POST | `/daily-load` | Registrar carga diaria | Sí |
| GET | `/dashboard` | Datos del dashboard | Sí |
| GET | `/profile` | Perfil del usuario | Sí |

Las rutas protegidas requieren el header `Authorization: Bearer <token>`.

## Estructura del proyecto

```
BACKEND/
├── src/
│   ├── app.js              # Configuración de Express
│   ├── controllers/        # Lógica de cada módulo
│   ├── routes/             # Definición de rutas
│   ├── middleware/         # Middlewares (auth, etc.)
│   └── db/
│       └── pool.js         # Conexión a PostgreSQL
├── server.js               # Punto de entrada
├── vercel.json             # Configuración de despliegue
└── .env.example            # Plantilla de variables de entorno
```

## Despliegue

La API está desplegada en Vercel con base de datos PostgreSQL en Neon:

**URL de producción**: `https://onami-app-backend-v1.vercel.app`
