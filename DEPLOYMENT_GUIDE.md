# 🌐 Guía de Deployment - FoodGestor

## 📋 Opciones de Hosting

Aquí están las opciones para desplegar tu app sin depender de tu PC:

| Opción | Dificultad | Costo | BD Online | Ventajas |
|--------|-----------|-------|-----------|----------|
| **Supabase** ⭐ | Muy Fácil | $0-100/mes | Sí (PostgreSQL) | Todo integrado, muy rápido |
| **Firebase** ⭐⭐ | Fácil | $0-100/mes | Sí (Firestore) | Serverless, escalable |
| **DigitalOcean** | Medio | $5-20/mes | Separado | Control total, barato |
| **Heroku** | Fácil | $7-50/mes | Separado | Fácil de deployar Python |
| **AWS** | Difícil | $1-200/mes | RDS | Profesional pero complejo |

---

## ⭐ Opción 1: Supabase (RECOMENDADO para principiantes)

### ¿Por qué Supabase?
✅ BD PostgreSQL en la nube incluida  
✅ Auth JWT integrada  
✅ API REST automática  
✅ Gratis para empezar  
✅ No necesitas backend Flask  

### Arquitectura con Supabase

```
┌─────────────────────────┐
│   Angular Frontend       │
│  (Tu app actual)        │
└──────────────┬──────────┘
               │
        HTTP (JSON-REST)
               │
┌──────────────▼──────────────────────┐
│      Supabase (SaaS)                │
│  ├─ PostgreSQL DB                  │
│  ├─ Auto-generated REST API         │
│  ├─ Auth/JWT                        │
│  └─ Real-time subscriptions         │
└─────────────────────────────────────┘
```

### Step-by-Step: Supabase

#### 1️⃣ Crear Cuenta

```
1. Ve a https://supabase.com
2. Sign up con email
3. Crea un proyecto nuevo
4. Selecciona región (ej: Europe)
5. Espera ~2 minutos a que se cree
```

#### 2️⃣ Copiar Credenciales

Una vez creado el proyecto:
```
Project Settings → API
- Copiar: SUPABASE_URL
- Copiar: SUPABASE_ANON_KEY
```

#### 3️⃣ Actualizar Frontend (Angular)

Instala el cliente Supabase:
```bash
cd frontend
npm install @supabase/supabase-js
```

Crea un servicio:
```typescript
// frontend/src/app/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://your-project.supabase.co',  // SUPABASE_URL
      'your-anon-key'                      // SUPABASE_ANON_KEY
    );
  }

  // Query
  async obtenerAlimentos() {
    const { data, error } = await this.supabase
      .from('alimentos')
      .select('*');
    return data;
  }

  // Insert
  async crearAlimento(alimento: any) {
    const { data, error } = await this.supabase
      .from('alimentos')
      .insert([alimento])
      .select();
    return data;
  }

  // Update
  async actualizarAlimento(id: number, datos: any) {
    const { data, error } = await this.supabase
      .from('alimentos')
      .update(datos)
      .eq('id', id)
      .select();
    return data;
  }
}
```

#### 4️⃣ Crear Tablas en Supabase

En Supabase Dashboard → SQL Editor:

```sql
-- Tabla de usuarios
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  nombre_completo VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de alimentos
CREATE TABLE alimentos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  nombre VARCHAR(255) NOT NULL,
  calorias FLOAT,
  proteinas FLOAT,
  grasas FLOAT,
  azucares FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de ingredientes
CREATE TABLE ingredientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  es_aditivo BOOLEAN DEFAULT FALSE,
  alergenos_categorias JSONB DEFAULT '[]',
  verificado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5️⃣ Desplegar Frontend

Opción A: Vercel (Recomendado, gratis)
```bash
# Instala Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel
```

Opción B: GitHub Pages
```bash
ng build --base-href="/FoodGestor/"
# Luego enable GitHub Pages en Settings
```

#### 6️⃣ Listo!

Tu app estará en: `https://tu-app.vercel.app`

---

## 🔥 Opción 2: Firebase

### Ventajas
✅ Base de datos Firestore (NoSQL)  
✅ Hosting incluido  
✅ Auth integrada  
✅ Gratis para pequeños proyectos  

### Setup

#### 1️⃣ Crear Proyecto Firebase
```
1. Ve a https://console.firebase.google.com
2. Crea proyecto
3. Habilita Firestore Database
4. Habilita Authentication
```

#### 2️⃣ Instalar SDK
```bash
cd frontend
npm install firebase @angular/fire
```

#### 3️⃣ Servicio Firebase
```typescript
// firebase.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  constructor(private firestore: Firestore) {}

  async obtenerAlimentos() {
    const querySnapshot = await getDocs(
      collection(this.firestore, 'alimentos')
    );
    return querySnapshot.docs.map(doc => doc.data());
  }
}
```

#### 4️⃣ Deploy a Firebase
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 🌊 Opción 3: DigitalOcean (Control Total)

### Arquitectura

```
Tu PC (desarrollo)
    ↓
GitHub (almacenar código)
    ↓
DigitalOcean App Platform
    ├─ Backend Flask
    └─ PostgreSQL Database
    ↓
Dominio (ej: miapp.com)
```

### Setup

#### 1️⃣ Crear Cuenta DigitalOcean
```
1. Ve a https://www.digitalocean.com
2. Sign up
3. Agrega método de pago
```

#### 2️⃣ Preparar Código para Deploy

Archivo: `backend/requirements.txt`
```
Flask==2.3.0
Flask-CORS==4.0.0
Flask-SQLAlchemy==3.0.0
flask-jwt-extended==4.4.0
python-dotenv==1.0.0
gunicorn==20.1.0
psycopg2-binary==2.9.0
```

Archivo: `backend/Procfile`
```
web: gunicorn main:app
```

Archivo: `backend/.env` (en DigitalOcean, no en git)
```
DATABASE_URL=postgresql://...
JWT_SECRET_KEY=tu-secret-key
FLASK_ENV=production
```

#### 3️⃣ Conectar a PostgreSQL

En DigitalOcean:
```
1. Crea database cluster PostgreSQL
2. Obtén DATABASE_URL
3. Reemplaza `sqlite` por PostgreSQL en app/__init__.py:

# Cambiar:
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///foodgestor.db'

# A:
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
```

#### 4️⃣ Deploy

```bash
# Opción A: GitHub Integration (recomendado)
# 1. Push a GitHub
git push origin main

# 2. En DigitalOcean Dashboard:
#    - Create App
#    - Connect GitHub repo
#    - Select main branch
#    - Configure environment variables
#    - Deploy!

# Opción B: Manual con CLI
doctl apps create --spec app.yaml
```

#### 5️⃣ Frontend en DigitalOcean Spaces

```bash
# Compilar
npm run build

# Upload a Spaces (CDN)
# O usa GitHub Pages / Vercel
```

---

## 📊 Comparación Rápida

### Para Empezar Rápido → **Supabase**
- No necesitas backend Flask
- Todo integrado
- 5 minutos para estar en producción
- Gratis inicialmente

### Para Control Total → **DigitalOcean**
- Mantienes tu backend Flask
- Costo predecible ($5-10/mes)
- Escalabilidad real
- 30 minutos para setup

### Opción Intermedia → **Firebase**
- Serverless (sin servidor)
- Escalado automático
- Gratis hasta cierto punto
- Cambia tu código significativamente

---

## 🛠️ Migración Step-by-Step: Local → Supabase

### Paso 1: Crear BD en Supabase
```sql
-- Ejecutar en Supabase SQL Editor las queries de creación de tablas
```

### Paso 2: Actualizar Servicios Angular
```typescript
// Cambiar de:
private http.get(`http://localhost:5000/api/alimentos`)

// A:
private supabase.from('alimentos').select('*')
```

### Paso 3: Ejecutar Migrations
```typescript
// Script para copiar datos de SQLite a Supabase
async function migrarDatos() {
  // 1. Obtener datos del backend actual
  // 2. Insertar en Supabase
}
```

### Paso 4: Testear
```bash
npm run build
# Probar en http://localhost:4200
```

### Paso 5: Desplegar
```bash
vercel deploy
```

---

## 💰 Costos Estimados

| Servicio | Tier Gratuito | Pago Mínimo |
|----------|---------------|------------|
| Supabase | 500MB BD + 2GB storage | $25/mes |
| Firebase | 1GB Firestore + 10GB storage | Pay as you go |
| DigitalOcean | $0 (necesitas pagar) | $5/mes |
| Vercel | Ilimitado (frontend) | $0 |
| GitHub Pages | Ilimitado (frontend) | $0 |

---

## 🎯 Mi Recomendación

### Si quieres la solución MÁS FÁCIL:
**Supabase + Vercel**
- ✅ Supabase para BD + API automática
- ✅ Vercel para frontend Angular
- ✅ Todo gratis inicialmente
- ✅ Setup en 30 minutos

### Si quieres mantener tu backend Flask:
**DigitalOcean App Platform**
- ✅ Sube tu código Flask
- ✅ PostgreSQL incluida
- ✅ $5-10/mes
- ✅ Control total

### Si quieres serverless full-stack:
**Firebase**
- ✅ Firestore para BD
- ✅ Firebase Hosting
- ✅ Reemplaza backend Flask
- ✅ Escalado automático

---

## 🚀 Próximos Pasos

1. **Elige una opción** (recomiendo Supabase para empezar)
2. **Crea la cuenta** (5 minutos)
3. **Adapta tu código** (1-2 horas)
4. **Deploy** (5-10 minutos)
5. **Testea** en tu móvil

¿Quieres que te ayude con los detalles de alguna opción específica?

---

**Última actualización:** Junio 2026
