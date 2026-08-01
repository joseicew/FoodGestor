# FoodGestor

Aplicación de gestión nutricional: catálogo de alimentos, raciones reutilizables y registro diario de comidas con seguimiento de calorías, macros y peso.

Incluye lectura de etiquetas por OCR (nombre, ingredientes, tabla nutricional y código de barras), avisos de alérgenos según el perfil del usuario y una PWA instalable, además de una app iOS empaquetada con Capacitor.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Angular 21 (standalone, zoneless), TypeScript 5.9, PWA con service worker |
| Móvil | Capacitor 8 (iOS) |
| Backend | Flask 3.1, SQLAlchemy 2.0, JWT (`flask-jwt-extended`) |
| Base de datos | PostgreSQL (Neon) |
| Panel admin | Angular (aplicación aparte, en `admin/`) |

## Estructura

```
frontend/   App principal Angular + proyecto iOS de Capacitor (frontend/ios)
backend/    API Flask (blueprints en app/routes, modelos en app/models)
admin/      Panel de administración
.github/    Workflows de build para iOS y Android
```

## Puesta en marcha

Requisitos: Node 22, Python 3.12 y una `DATABASE_URL` de PostgreSQL.

**Backend** — http://localhost:5000

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Necesita un `.env` con al menos `DATABASE_URL` y `JWT_SECRET_KEY`. Ver [CLOUD_DATABASE_SETUP.md](CLOUD_DATABASE_SETUP.md) para preparar la base de datos.

**Frontend** — http://localhost:4200

```bash
cd frontend
npm install
npm start
```

**Panel admin** — http://localhost:4300

```bash
cd admin
npm install
npm start -- --port 4300
```

## Build móvil

El IPA de iOS se genera desde GitHub Actions, no en local (hace falta un runner macOS):

```bash
gh workflow run build-ios.yml --ref main -f api_url=https://foodgestor-backend.onrender.com
```

Sale **sin firmar**, pensado para instalar con AltStore. El `api_url` se inyecta en `environment.prod.ts` durante el build, así que sirve tanto para apuntar a producción como a un backend local.

Existe también `build-android.yml`, que genera la plataforma Android en el propio workflow (`npx cap add android`); por eso la carpeta `android/` no está versionada y cualquier cambio nativo que se hiciera ahí se perdería en cada build.

## Despliegue

Todo se despliega en **Render**, con los tres servicios definidos en `render.yaml`:

| Servicio | URL |
|---|---|
| Backend (Flask) | https://foodgestor-backend.onrender.com |
| Frontend (Angular) | https://foodgestor-frontend.onrender.com |
| Panel admin | servicio estático independiente |

El backend usa runtime Python (no contenedor): `pip install -r requirements.txt` y arranque con `gunicorn main:app`, con health check en `/api/health`. El deploy es automático en cada push a `main`. Las variables de entorno van marcadas como `sync: false` en `render.yaml` y se gestionan desde el panel de Render.

Ver [ARQUITECTURA.md](ARQUITECTURA.md) para el detalle de la infraestructura.

## Documentación

- [ARQUITECTURA.md](ARQUITECTURA.md) — visión general del sistema y flujo de datos
- [CONTRIBUTING.md](CONTRIBUTING.md) — convenciones de código y de commits
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) y [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) — tokens visuales y criterios de interfaz
- [PWA_SETUP.md](PWA_SETUP.md) — service worker e instalación
- [CLOUD_DATABASE_SETUP.md](CLOUD_DATABASE_SETUP.md) — base de datos

## Notas

La app es **zoneless**: no se incluye `zone.js` y la detección de cambios va por signals. Al automatizar pruebas en navegador conviene tenerlo en cuenta, porque un `element.click()` sintético actualiza el estado del componente pero no repinta la vista; hacen falta eventos de ratón reales.
