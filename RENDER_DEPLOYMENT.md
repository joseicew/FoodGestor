# Despliegue en Render

FoodGestor se despliega entero en [Render](https://render.com). Los tres servicios están declarados en [`render.yaml`](render.yaml) (Blueprint), en la raíz del repositorio.

| Servicio | Tipo | URL |
|---|---|---|
| `foodgestor-backend` | Web (Python) | https://foodgestor-backend.onrender.com |
| `foodgestor-frontend` | Estático | https://foodgestor-frontend.onrender.com |
| `foodgestor-admin` | Estático | panel de administración |

La base de datos es PostgreSQL en [Neon](https://neon.tech), fuera de Render. Ver [CLOUD_DATABASE_SETUP.md](CLOUD_DATABASE_SETUP.md).

## Cómo funciona el despliegue

El despliegue es **automático**: cada push a `main` dispara una nueva build de los servicios afectados. No hay `autoDeploy: false` en el Blueprint, así que aplica el comportamiento por defecto de Render.

```
git push origin main → Render detecta el cambio → build → deploy
```

Para desplegar sin cambios de código (por ejemplo tras editar una variable de entorno), usa **Manual Deploy → Deploy latest commit** en el panel del servicio.

## Backend

```yaml
runtime: python          # NO es un contenedor
rootDir: backend
buildCommand: pip install -r requirements.txt
startCommand: gunicorn main:app
healthCheckPath: /api/health
plan: free
```

`PYTHON_VERSION` está fijado a `3.12.0`. El health check responde `{"status": "ok"}`; Render lo usa para dar por buena la instancia, así que si ese endpoint falla el deploy se marca como fallido aunque el proceso siga vivo.

### Variables de entorno

Van marcadas como `sync: false` en el Blueprint, es decir, **no se leen del repositorio**: hay que darlas de alta a mano en *Environment* dentro del panel del servicio.

| Variable | Obligatoria | Para qué |
|---|:---:|---|
| `DATABASE_URL` | **Sí** | Cadena de conexión de Neon (`postgresql://…?sslmode=require`) |
| `JWT_SECRET_KEY` | **Sí** | Firma de los tokens JWT |
| `ANTHROPIC_API_KEY` | Sí, para OCR | Lectura de etiquetas con Claude Vision |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Para el correo | Envío de recuperación de contraseña |
| `FRONTEND_URL` | Recomendada | Base de los enlaces que se envían por correo |

### Tres cosas que conviene saber

Ninguna de estas da error visible, y por eso muerden:

**Si falta `DATABASE_URL`, la app no falla: se cae a SQLite.** En `create_app()` el valor por defecto es `sqlite:///foodgestor.db`. En Render eso significa un fichero en disco efímero: la app arranca, parece sana, y los datos desaparecen en el siguiente deploy. Si ves que "se han borrado los datos", revisa primero esta variable.

**Si falta `JWT_SECRET_KEY`, se usa un secreto por defecto** (`desarrollo-secreto-cambiar-en-produccion`), que está escrito en el código y por tanto es público. Cualquiera podría firmar tokens válidos. Es obligatoria en producción.

**Si falta `FRONTEND_URL`, los correos de recuperación apuntan a `http://localhost:4200`**, que evidentemente no funciona para el usuario que los recibe.

### Plan gratuito

El backend está en plan `free`, que **suspende la instancia tras un rato sin tráfico**. La primera petición después de la pausa tarda bastante en responder mientras el servicio arranca. No es un fallo; si necesitas respuesta inmediata, hay que subir de plan.

Neon también pausa la base de datos por inactividad. El pool de SQLAlchemy ya está configurado para convivir con eso (`pool_pre_ping`, `pool_recycle: 300`, timeouts por debajo del de Gunicorn), así que la reconexión es transparente.

## Frontend y panel admin

Ambos son sitios estáticos con la misma receta:

```yaml
runtime: static
buildCommand: npm ci && npm run build -- --configuration=production
staticPublishPath: dist/<proyecto>/browser
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

`NODE_VERSION` está fijado a `22`. El *rewrite* es imprescindible: sin él, recargar en una ruta como `/calendario` daría 404, porque el enrutado lo resuelve Angular en el cliente.

La URL del backend **no** se configura por variable de entorno: está en `frontend/src/environments/environment.prod.ts` y se sustituye en tiempo de build. Para apuntar a otro backend hay que editar ese fichero (o usar el input `api_url` del workflow de iOS, que hace la sustitución durante el build).

## Cambiar la configuración

`render.yaml` es la fuente de verdad de la infraestructura. Si modificas comandos, rutas o servicios, Render recoge el cambio al detectar el push; para servicios nuevos puede hacer falta re-sincronizar el Blueprint desde el panel.

Las variables de entorno, en cambio, **solo viven en el panel**. Al añadir una nueva conviene documentarla en la tabla de arriba y añadirla a `render.yaml` con `sync: false`, para que quede constancia de que existe aunque su valor no esté en el repositorio.

## Verificar que un despliegue ha ido bien

```bash
# El backend responde
curl https://foodgestor-backend.onrender.com/api/health
# -> {"status":"ok"}

# El frontend sirve la SPA
curl -o /dev/null -w "%{http_code}\n" https://foodgestor-frontend.onrender.com
# -> 200
```

Si el health check responde pero la app falla al usarla, lo más probable es una variable de entorno ausente: los *Logs* del servicio en Render muestran el arranque de Gunicorn y cualquier excepción.

## Documentación relacionada

- [ARQUITECTURA.md](ARQUITECTURA.md) — visión general del sistema
- [CLOUD_DATABASE_SETUP.md](CLOUD_DATABASE_SETUP.md) — preparar la base de datos en Neon
- [PWA_SETUP.md](PWA_SETUP.md) — service worker e instalación como PWA
