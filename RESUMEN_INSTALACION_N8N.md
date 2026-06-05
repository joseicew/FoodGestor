# 🚀 RESUMEN: Instalación y Configuración de n8n

## ✅ STATUS: n8n INSTALADO Y CORRIENDO

**Versión**: 2.23.2  
**URL**: http://localhost:5678  
**Estado**: 🟢 ACTIVO

---

## 📋 TODO CHECKLIST

### ✅ YA COMPLETADO

- [x] n8n instalado con npm
- [x] n8n corriendo en http://localhost:5678
- [x] Backend Flask preparado para llamar a n8n
- [x] Documentación completa creada
- [x] Webhook de prueba local configurado (como fallback)

### 🔄 PRÓXIMAS ACCIONES (TÚ)

1. **[5 min]** Crear workflow en n8n
   - Abre: http://localhost:5678
   - Sigue: `CREAR_WORKFLOW_N8N_PASOS.md`

2. **[1 min]** Copiar URL del webhook
   - Ejemplo: `http://localhost:5678/webhook/procesar-ingrediente`

3. **[2 min]** Actualizar `.env`
   ```bash
   N8N_WEBHOOK_INGREDIENTES=http://localhost:5678/webhook/procesar-ingrediente
   ```

4. **[1 min]** Reiniciar Flask backend
   ```bash
   cd backend
   python main.py
   ```

5. **[5 min]** Hacer prueba completa
   ```bash
   # Obtener token JWT (registrarse)
   curl -X POST http://localhost:5000/api/auth/registro \
     -H "Content-Type: application/json" \
     -d '{"email": "test@test.com", "password": "Pass123"}'

   # Procesar todos los ingredientes
   curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar-todos \
     -H "Authorization: Bearer {TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

---

## 🎯 FLUJO COMPLETO

```
┌──────────────────────────────────────────────────────────────┐
│                    FOODGESTOR ARCHITECTURE                   │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐
│   FRONTEND  │
│  (Angular)  │
└──────┬──────┘
       │ POST /api/alimentos/ingredientes/procesar
       │ { "nombre": "Nuez" }
       ↓
┌─────────────────────┐
│  FLASK BACKEND      │
│ /api/alimentos      │
│ n8n_service.py      │ ← Llama a n8n
└──────┬──────────────┘
       │ POST http://localhost:5678/webhook/procesar-ingrediente
       │ { "nombre": "Nuez" }
       ↓
┌─────────────────────┐
│      N8N            │
│  Workflow           │
│  procesar-ingrediente
│                     │
│  Nodo 1: Webhook    │ ← Recibe request
│  Nodo 2: Set        │ ← Prepara datos
│  Nodo 3: Response   │ ← Responde con JSON
└──────┬──────────────┘
       │ { nombre, alergias, tipo, ... }
       ↓
┌─────────────────────┐
│  FLASK BACKEND      │
│ Procesa respuesta   │
│ Crea ingrediente    │
│ en la BD            │
└──────┬──────────────┘
       │ Respuesta al frontend
       ↓
┌─────────────┐
│   FRONTEND  │
│  Muestra OK │
└─────────────┘
```

---

## 📊 RESULTADO ESPERADO DESPUÉS DE LA PRUEBA

### Cuando llames al endpoint:
```bash
POST /api/alimentos/ingredientes/procesar-todos
```

### Verás respuesta como:
```json
{
  "mensaje": "Procesamiento completado: 50 actualizados, 0 con errores",
  "total_ingredientes": 50,
  "exitosos": 50,
  "errores": 0,
  "cambios": [
    {
      "nombre": "nuez",
      "cambios": {
        "descripcion": "Fruto seco oleaginoso...",
        "alergias": "frutos secos",
        "tipo": "fruto seco",
        "fuente_datos": "n8n",
        "verificado": true
      }
    },
    ...más ingredientes...
  ]
}
```

### En la BD:
```sql
SELECT nombre, tipo, alergias, fuente_datos, verificado 
FROM ingrediente 
LIMIT 10;

nuez      | fruto seco | frutos secos      | n8n | 1
leche     | lácteo     | lactosa, caseína  | n8n | 1
trigo     | cereal     | gluten            | n8n | 1
...
```

---

## 🎮 DIFERENCIA: Local vs n8n Real

### Webhook LOCAL de prueba (ahora mismo)
```
POST /api/test/webhook-ingrediente
Retorna: 10 ingredientes predefinidos
URL: http://localhost:5000/api/test/webhook-ingrediente
```

### n8n REAL (después del setup)
```
POST /webhook/procesar-ingrediente
Retorna: Datos estructurados
URL: http://localhost:5678/webhook/procesar-ingrediente
```

**Diferencia funcional**: Misma estructura, mismos campos, mismo resultado en BD. Solo cambia la fuente de datos (local vs n8n).

---

## 📝 DOCUMENTACIÓN DISPONIBLE

Creé varios documentos para ti:

1. **CREAR_WORKFLOW_N8N_PASOS.md** ← LEER PRIMERO
   - Instrucciones paso a paso para crear el workflow
   - Screenshots conceptuales
   - Troubleshooting

2. **N8N_WORKFLOW_INGREDIENTES.md**
   - Arquitectura detallada del workflow
   - Ejemplos de respuestas
   - Alternativas

3. **PROCESAR_TODOS_INGREDIENTES.md**
   - Cómo usar el endpoint de procesamiento masivo
   - Ejemplos de curl
   - Monitoreo

4. **AUDITORIA_CAMPOS_INGREDIENTE.md**
   - Verificación de que todos los campos están correctos
   - Mapeo BD vs código

---

## 🚨 NOTAS IMPORTANTES

### ⚠️ Para que n8n funcione correctamente:

1. **n8n debe estar corriendo**
   ```bash
   # Verificar que esté activo
   curl http://localhost:5678/ | head -5
   ```

2. **El workflow debe estar ACTIVE**
   - En el dashboard de n8n, asegúrate que el toggle esté verde

3. **La URL del webhook debe ser exacta**
   - Path: `procesar-ingrediente`
   - No: `procesar_ingredientes` (sin guión)

4. **El .env debe actualizarse**
   - Antes: `http://localhost:5000/api/test/webhook-ingrediente` (prueba local)
   - Después: `http://localhost:5678/webhook/procesar-ingrediente` (n8n real)

### ✅ Si algo falla:

**Opción A: Volver al webhook local**
```bash
# En .env
N8N_WEBHOOK_INGREDIENTES=http://localhost:5000/api/test/webhook-ingrediente
```

**Opción B: Reiniciar n8n**
```bash
# Kill n8n
killall node

# Reiniciar
n8n start
```

---

## 📱 URLS DE REFERENCIA

| Servicio | URL | Descripción |
|---|---|---|
| n8n Dashboard | http://localhost:5678 | Crear/editar workflows |
| n8n Webhook | http://localhost:5678/webhook/procesar-ingrediente | Endpoint para ingredientes |
| Flask Backend | http://localhost:5000 | API REST |
| OpenFoodFacts | https://world.openfoodfacts.org | BD pública de alimentos |

---

## ⏱️ TIEMPO ESTIMADO

- Crear workflow: **3-5 minutos**
- Actualizar config: **1 minuto**
- Hacer prueba: **5 minutos**
- **TOTAL: ~10 minutos**

---

## 🎯 PRÓXIMO PASO

👉 **Lee: `CREAR_WORKFLOW_N8N_PASOS.md`**

Luego:
1. Crea el workflow en http://localhost:5678
2. Copia la URL del webhook
3. Actualiza `.env`
4. Reinicia Flask
5. Haz la prueba con curl

¡Vamos! 🚀
