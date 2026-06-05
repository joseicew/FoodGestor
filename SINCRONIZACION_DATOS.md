# Guía de Sincronización de Datos - FoodGestor

## Arquitectura

El sistema FoodGestor funciona con una arquitectura **cliente-servidor**:

```
Frontend Angular (Puerto 4200)
        ↕ (HTTP Requests)
Backend Flask (Puerto 5000)
        ↕ (SQL)
Base de Datos SQLite (instance/foodgestor.db)
```

## Cómo Funcionan los Datos

### 1. **Almacenamiento de Alimentos**

Los alimentos se almacenan en la **base de datos SQLite**:
- **Ubicación**: `backend/instance/foodgestor.db`
- **Tabla**: `alimento`
- **Acceso**: Solo a través del API REST (Backend)

### 2. **Flujo de Datos Cuando Creas un Alimento**

```
Formulario (Frontend)
     ↓
Servicio AlimentosService
     ↓
POST /api/alimentos/ (Backend)
     ↓
Backend guarda en BD
     ↓
Respuesta con datos guardados
     ↓
Frontend muestra confirmación
```

### 3. **Sincronización Automática**

El frontend se **sincroniza automáticamente** en estos momentos:

1. **Al cargar la página** (ngOnInit)
2. **Cada 5 segundos** cuando estás en "Buscar" o "Favoritos"
3. **Al crear un nuevo alimento** (recarga después de 1 segundo)
4. **Al editar un alimento** (recarga inmediatamente)
5. **Al usar el botón "🔄 Sincronizar"** en la esquina superior derecha

## Verificación: Datos en Base de Datos

### Ver todos los alimentos en BD:

```bash
curl http://localhost:5000/api/alimentos/
```

### Contar cuántos alimentos hay:

```bash
cd backend
python3 << 'EOF'
import sqlite3
db = sqlite3.connect('instance/foodgestor.db')
cursor = db.cursor()
cursor.execute("SELECT COUNT(*) FROM alimento")
print(f"Total de alimentos: {cursor.fetchone()[0]}")
db.close()
EOF
```

## Posibles Problemas y Soluciones

### Problema 1: "No veo los alimentos que creé"

**Soluciones:**
1. Haz clic en el botón **🔄 Sincronizar** en la esquina superior derecha
2. Recarga la página (F5)
3. Verifica que el backend esté corriendo: `curl http://localhost:5000/api/alimentos/`

### Problema 2: "El API devuelve error 500"

**Causas comunes:**
- El backend no está corriendo
- Hay un error en la BD
- El archivo `instance/foodgestor.db` está corrupto

**Solución:**
```bash
# Reinicia el backend
cd backend
python main.py
```

### Problema 3: "Los datos no se guardan"

**Pasos de debugging:**

1. **Abre la consola del navegador** (F12) y ve a la pestaña "Network"
2. **Crea un alimento** y observa la solicitud POST
3. **Verifica el código de respuesta**:
   - `201` = Guardado correctamente ✓
   - `400` = Error en los datos (falta nombre, marca, etc.)
   - `409` = Duplicado (ya existe ese alimento)
   - `500` = Error del servidor

4. **Si es 201 pero no ves el alimento**:
   - Haz clic en 🔄 Sincronizar
   - Si aún no aparece, revisa los logs del backend

## Logs del Backend

Para ver qué está pasando en el backend:

```bash
# En la terminal donde corre Flask, verás logs como:
[2026-05-29 12:34:56] POST /api/alimentos/ - 201 Created
[2026-05-29 12:34:57] GET /api/alimentos/ - 200 OK
```

## Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/alimentos/` | Obtener todos los alimentos |
| POST | `/api/alimentos/` | Crear nuevo alimento |
| PUT | `/api/alimentos/{id}` | Editar alimento |
| DELETE | `/api/alimentos/{id}` | Eliminar alimento |
| POST | `/api/alimentos/duplicado` | Verificar si existe |
| GET | `/api/alimentos/{id}` | Obtener un alimento |

## Configuración de Sincronización

En `alimentos.ts`, puedes ajustar:

```typescript
// Intervalo de sincronización automática (ms)
setInterval(() => {
  if (this.activePanel === 'buscar' || this.activePanel === 'favoritos') {
    this.cargarAlimentos();
  }
}, 5000);  // Cambiar a 3000 para 3 segundos, 10000 para 10 segundos
```

## Buenas Prácticas

1. **Siempre verifica que el backend esté corriendo** antes de usar la app
2. **Usa el botón 🔄 Sincronizar** si sospechas que hay desincronización
3. **En la consola del navegador (F12)**, verás logs que indican qué alimentos se cargaron
4. **Si hay errores**, verifica que los datos sean válidos (nombre, marca, calorías, etc.)

## Comandos Útiles

### Verificar si el backend está corriendo:
```bash
curl http://localhost:5000/api/alimentos/ | head -5
```

### Ver todos los alimentos en BD con detalles:
```bash
cd backend
python3 << 'EOF'
import sqlite3
db = sqlite3.connect('instance/foodgestor.db')
cursor = db.cursor()
cursor.execute("SELECT id, nombre, marca, calorias FROM alimento")
for row in cursor.fetchall():
    print(f"[{row[0]}] {row[1]} ({row[2]}) - {row[3]} kcal")
db.close()
EOF
```

### Crear un alimento de prueba:
```bash
curl -X POST http://localhost:5000/api/alimentos/ \
  -F "nombre=Test" \
  -F "marca=Test" \
  -F "calorias=100" \
  -F "proteinas=5" \
  -F "grasas=5" \
  -F "hidratos_carbono=10" \
  -F "categoria=Otros" \
  -F "azucares=0" \
  -F "fibra=0" \
  -F "sal=0" \
  -F "sodio=0" \
  -F "ingredientes=[]"
```

## Resumen

- **Base de datos**: `backend/instance/foodgestor.db` (SQLite)
- **API**: `http://localhost:5000/api/alimentos/`
- **Frontend**: `http://localhost:4200`
- **Sincronización automática**: Cada 5 segundos en ciertas vistas
- **Sincronización manual**: Botón 🔄 Sincronizar en la esquina superior derecha
