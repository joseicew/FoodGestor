# 🏗️ Arquitectura de FoodGestor

## Visión General

FoodGestor es una aplicación de **gestión nutricional full-stack** con arquitectura moderna basada en microservicios cloud:

```
┌─────────────────────────────────────────────────────────────┐
│                      USUARIO (Web/Móvil)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────────────┐
│           FRONTEND (Angular 21 PWA)                        │
│           Netlify: food-gestor-frontent.netlify.app       │
│           - Componentes standalone                         │
│           - Design System v1.0                             │
│           - Dark Mode por defecto                          │
│           - Service Worker (offline support)               │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ▼
┌────────────────────────────────────────────────────────────┐
│           BACKEND (Flask REST API)                         │
│           Railway: foodgestor-backend-production           │
│           - Blueprints organizados                         │
│           - JWT Authentication                             │
│           - CORS habilitado                                │
│           - Docker containerizado                          │
└────────────────────────┬────────────────────────────────────┘
                         │ SQL
                         ▼
┌────────────────────────────────────────────────────────────┐
│           BASE DE DATOS (PostgreSQL)                       │
│           Neon: Cloud Database                             │
│           - Conexión SSL segura                            │
│           - Backups automáticos                            │
│           - Escalable en la nube                           │
└────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Carpetas

```
FoodGestor/
├── frontend/                          # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/           # Componentes standalone
│   │   │   │   ├── alimentos/        # Gestión de alimentos
│   │   │   │   ├── calendario/       # Calendario nutricional
│   │   │   │   ├── perfil/           # Perfil de usuario
│   │   │   │   ├── raciones/         # Raciones personalizadas
│   │   │   │   ├── login/            # Autenticación
│   │   │   │   ├── registro/         # Registro de usuarios
│   │   │   │   └── onboarding/       # Configuración inicial
│   │   │   ├── services/             # Lógica compartida
│   │   │   │   ├── auth.ts           # Autenticación JWT
│   │   │   │   ├── theme.ts          # Sistema de temas
│   │   │   │   ├── alimentos.ts      # API alimentos
│   │   │   │   ├── calendario.ts     # API calendario
│   │   │   │   ├── ai-vision.ts      # OCR/Claude Vision
│   │   │   │   └── session.ts        # Sesión usuario
│   │   │   ├── guards/               # Protección de rutas
│   │   │   │   └── auth.guard.ts     # Guard autenticación
│   │   │   ├── interceptors/         # Middleware HTTP
│   │   │   │   └── auth.interceptor  # Inyecta JWT token
│   │   │   ├── app.routes.ts         # Rutas principales
│   │   │   ├── app.ts                # Componente raíz
│   │   │   └── app.config.ts         # Configuración
│   │   ├── styles.css                # Design System v1.0
│   │   ├── manifest.json             # Metadatos PWA
│   │   ├── service-worker.js         # Offline support
│   │   └── environments/
│   │       └── environment.ts        # URLs API (Railway)
│   ├── public/
│   │   ├── assets/
│   │   │   ├── icon-192.png          # Icono PWA
│   │   │   └── icon-512.png          # Icono PWA
│   │   └── _redirects                # Reglas Netlify SPA
│   ├── angular.json                  # Configuración build
│   └── package.json                  # Dependencias
│
├── backend/                           # API Flask
│   ├── app/
│   │   ├── models/                   # Modelos SQLAlchemy
│   │   │   ├── usuario.py            # Usuarios
│   │   │   ├── alimento.py           # Alimentos
│   │   │   ├── racion.py             # Raciones
│   │   │   ├── ingrediente.py        # Ingredientes
│   │   │   └── comida_diaria.py      # Registro diario
│   │   ├── routes/                   # Blueprints API
│   │   │   ├── auth.py               # Login/Registro
│   │   │   ├── alimentos.py          # CRUD alimentos
│   │   │   ├── raciones.py           # CRUD raciones
│   │   │   ├── calendario.py         # Calendario diario
│   │   │   ├── ingredientes.py       # Ingredientes
│   │   │   └── ocr.py                # OCR/Claude Vision
│   │   └── __init__.py               # Factory app
│   ├── main.py                       # Punto de entrada
│   ├── requirements.txt               # Dependencias Python
│   └── Dockerfile                    # Contenedor Docker
│
├── netlify.toml                      # Config Netlify
├── Dockerfile                        # Imagen Docker
├── entrypoint.sh                     # Script inicio Railway
├── DESIGN_SYSTEM.md                  # Sistema de diseño
├── ARQUITECTURA.md                   # Este archivo
└── README.md                         # Documentación principal
```

---

## 🌐 Infraestructura Cloud

### 1. **Netlify** (Frontend)
**URL:** https://food-gestor-frontent.netlify.app

**¿Qué es?**
- Plataforma de hosting para aplicaciones web estáticas/SPA
- Deploy automático desde GitHub

**¿Para qué lo usamos?**
- ✅ Servir la aplicación Angular compilada
- ✅ Manejo automático de rutas SPA (redirect /* → /index.html)
- ✅ HTTPS gratuito
- ✅ CDN global para rápido acceso
- ✅ Deploy automático en cada push a main

**Configuración:**
- **Build command:** `cd frontend && npm install && npm run build`
- **Publish directory:** `frontend/dist/frontend/browser`
- **Archivo de redirección:** `frontend/public/_redirects`

---

### 2. **Railway** (Backend)
**URL:** https://foodgestor-backend-production.up.railway.app

**¿Qué es?**
- Plataforma de hosting para aplicaciones containerizadas
- Soporte nativo para Docker

**¿Para qué lo usamos?**
- ✅ Ejecutar servidor Flask REST API
- ✅ Procesar requests de autenticación, alimentos, calendario
- ✅ Conectar a base de datos PostgreSQL
- ✅ Escalabilidad automática
- ✅ Variables de entorno seguras

**Configuración:**
- **Builder:** Dockerfile
- **Puerto:** 8000 (dinámico desde env $PORT)
- **Entrypoint:** `entrypoint.sh` → gunicorn con --pythonpath
- **Dockerfile:** Python 3.11-slim, instala dependencias, ejecuta gunicorn

**Flujo:**
```
GitHub push → Railway detecta cambio → Docker build → Contenedor inicia
```

---

### 3. **Neon** (Base de Datos)
**Proveedor:** PostgreSQL Cloud

**¿Qué es?**
- Base de datos PostgreSQL administrada en la nube
- Alternativa a RDS, más rápida y económica

**¿Para qué lo usamos?**
- ✅ Almacenar usuarios (email, hash password, perfil)
- ✅ Almacenar alimentos con macros
- ✅ Almacenar raciones personalizadas
- ✅ Almacenar registro diario de comidas
- ✅ Almacenar ingredientes disponibles

**Tablas principales:**
| Tabla | Propósito |
|-------|-----------|
| `usuario` | Usuarios registrados, auth data |
| `alimento` | Alimentos con macros (calorias, proteinas, grasas) |
| `racion` | Porciones personalizadas por usuario |
| `ingrediente` | Ingredientes disponibles para OCR |
| `comida_diaria` | Registro de comidas por fecha |

**Seguridad:**
- Conexión SSL requerida (sslmode=require)
- URL de conexión en variable de entorno `DATABASE_URL`
- Backups automáticos

---

## 🔄 Flujo de Datos

### Ejemplo: Usuario agrega un alimento

```
1. FRONTEND (Angular)
   └─ Usuario escribe "Manzana" en form
   └─ Submit → AlimentosService.crearAlimento()

2. HTTP REQUEST
   └─ POST https://foodgestor-backend-production.up.railway.app/api/alimentos
   └─ Header: Authorization: Bearer {JWT_token}
   └─ Body: { nombre: "Manzana", calorias: 95, ... }

3. BACKEND (Flask)
   └─ AuthInterceptor valida JWT
   └─ Route: POST /api/alimentos
   └─ Crear modelo Alimento()
   └─ Validar datos
   └─ db.session.add() → Guardar en Neon
   └─ Response: { id: 1, nombre: "Manzana", ... }

4. DATABASE (Neon PostgreSQL)
   └─ INSERT INTO alimento (usuario_id, nombre, calorias, ...)
   └─ Persistencia segura

5. FRONTEND (Angular)
   └─ Recibe respuesta
   └─ Actualiza lista de alimentos
   └─ Toast: "Alimento agregado ✓"
```

---

## 🔐 Seguridad

### Autenticación JWT
```
1. Usuario login: POST /api/auth/login { email, password }
2. Backend: hash password, valida, genera JWT token
3. Frontend: localStorage.setItem('auth_token', token)
4. Cada request: Authorization: Bearer {token}
5. Backend: Valida JWT, obtiene usuario_id
6. Datos filtrados por usuario_id en queries
```

### Encriptación
- **Passwords:** Werkzeug hash (seguro)
- **Conexión DB:** SSL/TLS (Neon)
- **API:** HTTPS (Railway + Netlify)
- **JWT:** Firma con secret key

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| **Frontend Bundle** | ~186 KB (gzipped) |
| **Framework** | Angular 21 |
| **Backend Framework** | Flask 3.1 |
| **Database** | PostgreSQL (Neon) |
| **Autenticación** | JWT |
| **Deploy** | Automated (GitHub → Netlify/Railway) |
| **HTTPS** | ✅ Todas las conexiones |
| **Dark Mode** | ✅ Por defecto |
| **PWA Installable** | ✅ Sí |
| **Offline Support** | ✅ Service Worker |

---

## 🚀 Próximos Pasos

### Fase 2: Sistema de Usuarios Completo
- [x] Modelo Usuario
- [ ] Autenticación JWT
- [ ] Onboarding con TMB/TDEE
- [ ] Límites personalizados
- [ ] Edición de perfil

### Fase 3: OCR & IA
- [ ] Captura de fotos de ingredientes
- [ ] Análisis con Claude Vision
- [ ] Extracción automática de macros
- [ ] Búsqueda por código de barras

### Fase 4: Análisis & Reportes
- [ ] Gráficas de progreso
- [ ] Historial de consumo
- [ ] Reportes semanales/mensuales
- [ ] Recomendaciones personalizadas

---

## 📚 Referencias Útiles

- **Design System:** Ver [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- **Documentación Angular:** https://angular.io/docs
- **Documentación Flask:** https://flask.palletsprojects.com/
- **PostgreSQL:** https://www.postgresql.org/docs/
- **JWT:** https://jwt.io/

---

**Última actualización:** 11 de junio, 2026  
**Versión:** 1.0  
**Mantenedor:** Joza
