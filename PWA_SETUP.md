# 📱 Configuración PWA (Progressive Web App) - FoodGestor

## 🎯 ¿Qué es una PWA?

Una **Progressive Web App (PWA)** es una aplicación web que:
- ✅ Es **instalable** en Android/iOS como una app nativa
- ✅ Funciona **offline** con caché local
- ✅ Ofrece experiencia **similar a aplicación nativa**
- ✅ No requiere App Store
- ✅ Se actualiza automáticamente

## 🚀 FoodGestor como PWA

FoodGestor ahora está configurado como PWA. Cuando se despliega en HTTPS, los usuarios en Android verán un botón "Instalar" en el navegador.

### Archivos PWA Creados

```
frontend/src/
├── manifest.json          # Metadata de la app (nombre, icono, colores)
├── service-worker.js      # Caché offline y estrategia de red
└── index.html             # Meta tags PWA (viewport, apple-mobile-web-app-)
```

---

## 📋 Configuración Actual

### 1. **manifest.json**
- **Nombre:** FoodGestor - Gestión Nutricional
- **Descripción:** App para gestionar alimentos, raciones y seguimiento nutricional diario
- **Scope:** `/` (todo el sitio)
- **Display:** `standalone` (pantalla completa sin UI del navegador)
- **Tema:** Azul (#007AFF) con fondo blanco

### 2. **service-worker.js**
- **Estrategia de caché:** Network-first para assets, sin caché para API
- **Cache Name:** `foodgestor-v1`
- **Assets Cacheados:**
  - `/`
  - `/index.html`
  - `/styles.css`
  - `/favicon.ico`
  - `/manifest.json`

**Flujo de Fetch:**
```
Solicitud → ¿Es API (/api/...)? 
  ├─ Sí → Red (sin caché)
  └─ No → Red → Cache fallback → Offline respuesta
```

### 3. **index.html - Meta Tags PWA**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#007AFF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FoodGestor">
<link rel="manifest" href="manifest.json">
```

---

## 📦 Desplegar PWA en Producción

### Requisitos Obligatorios

1. ✅ **HTTPS** (sin HTTPS, PWA no funciona)
2. ✅ **manifest.json** (✓ Hecho)
3. ✅ **service-worker.js** (✓ Hecho)
4. ✅ **Meta tags PWA** (✓ Hecho)
5. ✅ **Build compilado** (`npm run build` ✓)

### Opción 1: Vercel (Recomendado para PWA) ⭐

Vercel ofrece HTTPS automático y es perfecto para Angular.

#### Step-by-Step

**1. Crear cuenta en Vercel**
```
https://vercel.com/signup
```

**2. Instalar Vercel CLI**
```bash
npm install -g vercel
```

**3. Desplegar desde raíz del proyecto**
```bash
cd C:\Users\Joza\Documents\Proyectos\FoodGestor
vercel --prod
```

**4. Configurar para servir dist/frontend**
Cuando Vercel pregunte por el directorio, usa:
```
dist/frontend
```

**5. Listo!**
Tu PWA estará en `https://foodgestor.vercel.app` (o tu dominio personalizado)

---

### Opción 2: Netlify

Alternativa a Vercel, también con HTTPS gratuito.

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Desplegar
netlify deploy --prod --dir=frontend/dist/frontend
```

---

### Opción 3: GitHub Pages + Cloudflare

Para máximo control y sin dependencias de terceros.

**1. Push a GitHub**
```bash
git remote add origin https://github.com/tuusuario/foodgestor.git
git push -u origin main
```

**2. Activar GitHub Pages en Settings**
- Source: Deploy from a branch
- Branch: main
- Folder: `/frontend/dist/frontend`

**3. Agregar Cloudflare para HTTPS**
- Ir a https://dash.cloudflare.com
- Agregar dominio
- Cambiar nameservers en tu registrador
- Cloudflare maneja HTTPS automáticamente

---

## 🔍 Verificar que PWA Funciona

### En Android Chrome

1. **Desplegar** en HTTPS (Vercel, Netlify, etc.)
2. **Abrir** en Chrome Mobile
3. **Ver** icono "Instalar" o "⋮" → "Instalar app"
4. **Confirmar** instalación
5. **App aparece** en pantalla de inicio

### En PC (Testing)

```bash
# Terminal 1: Compilar en watch
cd frontend
npm run build -- --watch --configuration development

# Terminal 2: Servir con HTTPS simulado
cd dist/frontend
npx http-server -p 4200 -c-1 -S # -S para HTTPS auto-generado

# Terminal 3: Abrir en Chrome
# Ir a https://localhost:4200
```

En DevTools (F12):
- **Application** → **Manifest** → Verifica que se cargó
- **Application** → **Service Workers** → Verifica que está registrado
- **Application** → **Cache Storage** → Verifica cachés

---

## 🔄 Actualizar Service Worker

### Cuando cambies assets:

**1. Actualiza CACHE_NAME en service-worker.js**
```javascript
const CACHE_NAME = 'foodgestor-v2'; // Cambiar versión
```

**2. Recompila y despliega**
```bash
npm run build
vercel --prod  # o tu comando de despliegue
```

**3. Usuarios verán actualización** automáticamente (la próxima vez que recarguen)

---

## 📊 Verificación de PWA (Lighthouse)

En Chrome DevTools:
1. Abre DevTools (F12)
2. Ir a **Lighthouse**
3. Selecciona **PWA**
4. Click **Analyze page load**

✅ Esperado: Score 90+

---

## 🧠 Cómo Funciona Offline

1. **Primera visita:** 
   - Navegador descarga `dist/frontend/*`
   - Service Worker cachea assets principales
   - Usuario ve app completa

2. **Sin conexión:**
   - Fetch a `/api/*` → Error (no hay caché para APIs)
   - Fetch a `styles.css`, etc. → Respuesta cacheada

3. **Reconexión:**
   - Siguiente fetch a `/api/*` → Va a la red
   - Backend retorna datos frescos
   - UI se actualiza

---

## 📂 Estructura Desplegada

```
Vercel / Netlify / Server
│
└── https://foodgestor.app/
    ├── index.html             ← Main app shell
    ├── main-[hash].js         ← Angular + código
    ├── styles-[hash].css      ← Estilos compilados
    ├── manifest.json          ← Metadata PWA
    ├── service-worker.js      ← Caché offline
    ├── favicon.ico            ← Icono
    └── assets/
        └── ... (archivos estáticos)
```

---

## 🚨 Troubleshooting

### "PWA no aparece en menú Instalar"

✓ **Verifica:**
1. Está en HTTPS (obligatorio)
2. manifest.json es válido (DevTools → Application → Manifest)
3. Service Worker está registrado (DevTools → Application → Service Workers)

### "Service Worker no se actualiza"

✓ **Solución:**
1. En DevTools → Service Workers → Click "Unregister"
2. Recarga página (Ctrl+Shift+R full reload)
3. Service Worker nuevo se registra automáticamente

### "API no funciona offline"

✓ **Es correcto**: Service Worker NO cachea APIs (/api/...) intencionalmente.
Las APIs deben estar en línea. Para offline completo, necesitas IndexedDB (futuro).

---

## 🎯 Próximos Pasos (Futuro)

Para mejorar la PWA:

1. **Agregar iconos reales** (192x192, 512x512 PNG)
2. **IndexedDB** para persistencia de datos offline
3. **Notificaciones push** (requiere backend)
4. **Splash screen** personalizado (iOS)
5. **Dark mode** en manifest.json

---

## ✅ Checklist Despliegue

- [ ] Compilar: `npm run build`
- [ ] Verificar HTTPS en servidor
- [ ] manifest.json en raíz
- [ ] service-worker.js en raíz
- [ ] index.html con meta tags PWA
- [ ] Probar en Chrome Mobile (botón Instalar)
- [ ] Probar offline (DevTools → Network → Offline)
- [ ] Lighthouse PWA score 90+

---

**¡Tu FoodGestor está listo para ser una PWA instalable en Android!** 🎉
