# ☁️ Conectar Backend Flask a Base de Datos en la Nube

## 🎯 Objetivo

Mantener **100% del código Flask igual**, solo cambiar:
```
SQLite (local) → PostgreSQL (en la nube)
```

Tu código Flask seguirá funcionando exactamente igual.

---

## 📊 Comparación: SQLite vs PostgreSQL

| Aspecto | SQLite | PostgreSQL en Nube |
|--------|--------|-------------------|
| **Setup** | Cero configuración | 5 minutos |
| **Código Flask** | Sin cambios | Sin cambios |
| **Almacenamiento** | Tu PC | Servidores remotos |
| **Acceso** | Solo tu PC | Desde cualquier lugar |
| **Costo** | Gratis | $0-20/mes |
| **Escalabilidad** | Limitada | Ilimitada |

---

## 🚀 Opción 1: ElephantSQL (MÁS FÁCIL) ⭐⭐⭐

### ¿Por qué ElephantSQL?
✅ PostgreSQL managed (no administras servidor)  
✅ Plan gratuito: 20MB de datos  
✅ Perfect para testing  
✅ Sin tarjeta de crédito para trial  

### Step-by-Step

#### 1️⃣ Crear Cuenta

```
1. Ve a https://www.elephantsql.com
2. Sign up (gratis)
3. Crea una instancia "Tiny Turtle" (gratis)
4. Selecciona región (ej: Europe)
```

#### 2️⃣ Obtener Connection String

```
ElephantSQL Dashboard → Tu instancia → Details
```

Copiarás algo como:
```
postgresql://usuario:password@host:5432/nombre_bd
```

#### 3️⃣ Instalar PostgreSQL Driver

```bash
cd backend
pip install psycopg2-binary
```

#### 4️⃣ Actualizar `backend/app/__init__.py`

**Antes (SQLite):**
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///foodgestor.db'
```

**Después (PostgreSQL en nube):**
```python
import os
from dotenv import load_dotenv

load_dotenv()

# Usar PostgreSQL en la nube
DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Fallback a SQLite si no hay URL (desarrollo local)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///foodgestor.db'
```

#### 5️⃣ Crear `.env` con Credenciales

Archivo: `backend/.env` (NO SUBIR A GIT)
```
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_bd
FLASK_ENV=development
JWT_SECRET_KEY=tu-clave-secreta
```

Actualizar `.gitignore`:
```
.env
__pycache__/
*.pyc
venv/
```

#### 6️⃣ Inicializar BD en la Nube

```bash
cd backend
python
```

Dentro de Python:
```python
from app import app, db
from app.models.usuario import Usuario
from app.models.ingrediente import Ingrediente
from app.models.alimento import Alimento

with app.app_context():
    db.create_all()
    print("✅ Tablas creadas en la BD en la nube!")
    
exit()
```

#### 7️⃣ Testear Conexión

```bash
# Ejecutar backend
python main.py

# En otra terminal, testear API
curl http://localhost:5000/api/alimentos
```

**¡Debería funcionar exactamente igual que antes!**

---

## 🛠️ Opción 2: DigitalOcean Managed PostgreSQL

Si quieres más datos gratis:

### Setup

```
1. Ve a https://www.digitalocean.com
2. Create → Databases → PostgreSQL
3. Selecciona plan $15/mes (pero hay free trial)
4. Obtén connection string
5. Mismo proceso que ElephantSQL arriba
```

---

## 🔄 Opción 3: Cambio Híbrido (Recomendado para Testing)

Usa PostgreSQL para testing, SQLite para desarrollo:

```python
# backend/app/__init__.py
import os

env = os.getenv('FLASK_ENV', 'development')

if env == 'production':
    # Testing en la nube
    DATABASE_URL = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Desarrollo local con SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///foodgestor.db'
```

**Uso:**
```bash
# Desarrollo local (SQLite)
python main.py

# Testing en la nube (PostgreSQL)
FLASK_ENV=production DATABASE_URL=postgresql://... python main.py
```

---

## ⚙️ Configurar para Testing en la Nube

### Paso 1: Backend en tu PC pero conectado a BD en nube

```bash
# Terminal 1: Backend conectado a BD en nube
cd backend
FLASK_ENV=production DATABASE_URL=postgresql://user:pass@host/db python main.py
# Esperando en http://localhost:5000
```

### Paso 2: Frontend sigue igual

```bash
# Terminal 2: Frontend (sin cambios)
cd frontend
npm run build -- --watch --configuration development

# Terminal 3: HTTP Server (sin cambios)
cd frontend/dist/frontend/browser
http-server -p 4200 -a 192.168.1.17
```

### Paso 3: Testear

```
http://192.168.1.17:4200
↓
API calls a localhost:5000
↓
Backend conectado a PostgreSQL en la nube
↓
Datos persisten online
```

---

## 🧪 Ventajas de Testing Así

✅ **Código Flask sin cambios** - Sigue siendo 100% igual  
✅ **BD en la nube** - Datos persisten fuera de tu PC  
✅ **Mismo en dev y prod** - Mismo servidor/código  
✅ **Fácil migración** - Si decides deployar, no hay cambios  
✅ **Sin depender de tu PC** - Puedes apagar el ordenador y la BD sigue allí  

---

## 🔍 Verificar Conexión

### Testear desde Frontend

```typescript
// En la consola del navegador:
fetch('http://192.168.1.17:4200/api/alimentos')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Conectado a BD en nube:', data);
  })
  .catch(e => console.error('❌ Error:', e));
```

### Testear desde Terminal

```bash
# Verificar que la BD en nube está accesible
psql postgresql://user:pass@host:5432/db -c "SELECT version();"
```

---

## 📈 Escalabilidad

Cuando decidas deployar:

```
Actual (testing):
Backend local → BD nube (ElephantSQL)

Después (producción):
Backend en nube → BD nube (misma)
```

**¡Sin cambiar ni una línea de código!**

---

## 💰 Costos

| Servicio | Costo |
|----------|-------|
| ElephantSQL | Gratis (20MB) |
| DigitalOcean DB | $15/mes (5GB) |
| Backend local | Gratis |
| **Total** | **Gratis - $15/mes** |

---

## 🚨 Troubleshooting

### "Connection refused"
```python
# Verificar que DATABASE_URL es correcto
import os
print(os.getenv('DATABASE_URL'))
```

### "Column doesn't exist"
```python
# BD en nube está vacía, ejecutar:
with app.app_context():
    db.create_all()
```

### "Too many connections"
```
Plan ElephantSQL tiene 5 conexiones máximo
Solución: Usar connection pooling

app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_size': 3,
    'pool_recycle': 3600,
    'max_overflow': 0,
}
```

---

## 🎯 Mi Recomendación

### Para Testing Rápido:

```
1. Crear cuenta ElephantSQL (2 minutos)
2. Obtener CONNECTION_STRING
3. Crear .env con DATABASE_URL
4. Cambiar 3 líneas en app/__init__.py
5. Ejecutar: FLASK_ENV=production python main.py
6. ¡Listo! BD en la nube funcionando
```

**Total: 10 minutos de setup**

---

## 📝 Resumen Cambios

**Archivos que cambias:**
```
backend/
├── .env                    (CREAR - NO en git)
├── .gitignore              (AGREGAR .env)
├── app/__init__.py         (MODIFICAR 5 líneas)
└── requirements.txt        (AGREGAR psycopg2-binary)
```

**Código Flask:**
```
Sin cambios ✅
```

**API endpoints:**
```
Sin cambios ✅
```

**Frontend:**
```
Sin cambios ✅
```

---

¿Quieres que te ayude a:
1. ✅ Crear cuenta en ElephantSQL?
2. ✅ Configurar el `.env`?
3. ✅ Testear la conexión?
