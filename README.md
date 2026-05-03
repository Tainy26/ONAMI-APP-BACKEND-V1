# ONAMI — Backend

> API REST para la plataforma de gestión deportiva ONAMI.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Desplegado_en-Vercel-000000?style=flat&logo=vercel&logoColor=white)

---

## ✨ Características

- 🔐 **Autenticación JWT** — Registro, login y verificación de sesión
- 👥 **Gestión de roles** — Lógica diferenciada para entrenadores y atletas
- 🏋️ **Módulos completos** — Equipos, atletas, sesiones y carga diaria
- 📊 **Dashboard** — Datos agregados por rol para visualización
- ☁️ **Serverless** — Desplegado como función en Vercel con BD en Neon

---

## 🛠️ Tecnologías

| Tecnología | Uso |
|---|---|
| Node.js | Entorno de ejecución |
| Express 5 | Framework HTTP |
| PostgreSQL | Base de datos relacional |
| pg | Cliente PostgreSQL para Node.js |
| JWT | Autenticación stateless |
| bcrypt | Hash de contraseñas |
| dotenv | Gestión de variables de entorno |
| cors | Control de acceso entre dominios |

---

## 🚀 Instalación y uso

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

```bash
# Iniciar el servidor
npm start
```

El servidor se iniciará en `http://localhost:3000`.

---

## 📡 Endpoints

| Método | Ruta | Descripción | Protegida |
|--------|------|-------------|:---------:|
| GET | `/` | Estado de la API | ❌ |
| POST | `/auth/register` | Registro de usuario | ❌ |
| POST | `/auth/login` | Inicio de sesión | ❌ |
| GET | `/auth/me` | Usuario autenticado | ✅ |
| GET | `/athletes` | Listar atletas | ✅ |
| GET | `/teams` | Listar equipos | ✅ |
| POST | `/teams` | Crear equipo | ✅ |
| GET | `/sessions` | Listar sesiones | ✅ |
| POST | `/sessions` | Crear sesión | ✅ |
| GET | `/daily-load` | Cargas diarias | ✅ |
| POST | `/daily-load` | Registrar carga diaria | ✅ |
| GET | `/dashboard` | Datos del dashboard | ✅ |
| GET | `/profile` | Perfil del usuario | ✅ |

Las rutas protegidas requieren el header `Authorization: Bearer <token>`.

---

## 📁 Estructura del proyecto

```
BACKEND/
├── src/
│   ├── app.js              # Configuración de Express y middlewares
│   ├── controllers/        # Lógica de negocio de cada módulo
│   ├── routes/             # Definición de rutas
│   ├── middleware/         # Middlewares (autenticación, etc.)
│   └── db/
│       └── pool.js         # Conexión a PostgreSQL
├── server.js               # Punto de entrada
├── vercel.json             # Configuración de despliegue
└── .env.example            # Plantilla de variables de entorno
```

---

## 🌐 Producción

La API está desplegada en Vercel con base de datos PostgreSQL en Neon:

🔗 **[https://onami-app-backend-v1.vercel.app](https://onami-app-backend-v1.vercel.app)**
