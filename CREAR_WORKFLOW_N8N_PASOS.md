# Crear Workflow en n8n - GUÍA PASO A PASO

## ✅ n8n está corriendo en: http://localhost:5678

---

## 📋 Resumen Rápido

Vamos a crear un workflow **SIMPLE** que:
1. Recibe un POST con `{"nombre": "Nuez"}`
2. Busca en OpenFoodFacts (opcional)
3. Retorna datos estructurados

**Tiempo estimado: 3-5 minutos**

---

## 🎯 Pasos

### Paso 1: Abrir n8n Dashboard
1. Abre tu navegador en: **http://localhost:5678**
2. Si es la primera vez, te pedirá un email/contraseña (crea uno)
3. Haz click en **"Create New Workflow"**

---

### Paso 2: Agregar Nodo 1 - WEBHOOK (Trigger)

1. En el canvas vacío, haz click en el ícono **"+"** o arrastra un nodo
2. Busca **"Webhook"** y selecciona
3. Configura:
   - **Method**: POST
   - **Path**: `procesar-ingrediente` ← Importante
   - **Response mode**: When last node finishes
   
4. Haz click en **"Copy webhook URL"** y guárdala (la necesitaremos)

**Ejemplo de URL que se genera:**
```
http://localhost:5678/webhook/procesar-ingrediente
```

---

### Paso 3: Agregar Nodo 2 - SET (Preparar respuesta)

1. Haz click en el nodo Webhook → **"+"** para agregar el siguiente nodo
2. Busca **"Set"** y selecciona
3. Click en **"Add Assignment"** y configura campos:

**Campo 1:**
- **Name**: `nombre`
- **Value**: `{{ $json.nombre }}`

**Campo 2:**
- **Name**: `descripcion`
- **Value**: (dejar vacío o agregar valor por defecto)

**Campo 3:**
- **Name**: `alergias`
- **Value**: (dejar vacío)

**Campo 4:**
- **Name**: `intolerancias`
- **Value**: (dejar vacío)

**Campo 5:**
- **Name**: `tipo`
- **Value**: (dejar vacío)

**Campo 6:**
- **Name**: `origen`
- **Value**: (dejar vacío)

**Campo 7:**
- **Name**: `organico`
- **Value**: `false`

**Campo 8:**
- **Name**: `notas`
- **Value**: `Información de prueba`

---

### Paso 4: Agregar Nodo 3 - RESPONSE (Responder)

1. Click en nodo Set → **"+"**
2. Busca **"Respond to webhook"** y selecciona
3. Configurar:
   - **Response Code**: 200
   - **Response Body**: (deixa por defecto o personaliza)

---

### Paso 5: Conectar Nodos

Asegúrate que los nodos estén conectados en este orden:

```
Webhook → Set → Respond to webhook
```

Si faltan conexiones, arrastra desde los puntos de conexión.

---

### Paso 6: Guardar Workflow

1. Click en **"Save"** (esquina superior derecha)
2. Dale un nombre: **"FoodGestor - Procesar Ingredientes"**
3. Click en **"Save"** nuevamente

---

### Paso 7: Activar Workflow

1. Click en el toggle **"Active"** (esquina superior derecha)
2. Debería cambiar a color verde ✅

---

## 🧪 Probar el Workflow

### Opción 1: Desde Terminal

```bash
curl -X POST http://localhost:5678/webhook/procesar-ingrediente \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Nuez"}'
```

**Respuesta esperada:**
```json
{
  "nombre": "Nuez",
  "descripcion": "",
  "alergias": "",
  "intolerancias": "",
  "tipo": "",
  "origen": "",
  "organico": false,
  "notas": "Información de prueba"
}
```

### Opción 2: Desde n8n Test

1. Click en el nodo Webhook
2. Click en **"Send Test Data"**
3. Debería ejecutarse y mostrar resultado

---

## 📝 Configurar el Backend

Una vez que el workflow esté funcionando:

### 1. Obtener la URL del Webhook

La URL es: `http://localhost:5678/webhook/procesar-ingrediente`

### 2. Actualizar `.env`

Edita `/backend/.env`:

```bash
N8N_WEBHOOK_INGREDIENTES=http://localhost:5678/webhook/procesar-ingrediente
```

### 3. Reiniciar Flask

```bash
python main.py
```

---

## ✅ VERSIÓN AVANZADA (Búsqueda en OpenFoodFacts)

Si quieres que n8n busque datos reales en OpenFoodFacts:

### Agregar Nodo HTTP Request (antes del Set)

Nodo a insertar entre **Webhook** y **Set**:

1. Click Webhook → **"+"** → **"HTTP Request"**
2. Configurar:
   - **Method**: GET
   - **URL**: `https://world.openfoodfacts.org/cgi/search.pl`
   - **Query Parameters**: 
     - `search_terms`: `{{ $json.nombre }}`
     - `json`: `1`

3. En el nodo Set, puedes hacer referencias como:
   - `{{ $node["HTTP Request"].json.products[0].product_name }}`
   - `{{ $node["HTTP Request"].json.products[0].allergens }}`

---

## 🎨 Captura Visual (en orden)

```
┌─────────────────┐
│     WEBHOOK     │  ← Recibe POST
│ Path: procesar  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│      SET        │  ← Prepara datos
│  nombre: $json  │
│  alergias: ""   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    RESPONSE     │  ← Retorna JSON
│   Code: 200     │
└─────────────────┘
```

---

## 🚨 Troubleshooting

### El webhook no funciona
- ✅ Verifica que el workflow esté **Active** (toggle verde)
- ✅ Copia la URL correcta del webhook
- ✅ Reinicia n8n si es necesario

### La respuesta está vacía
- ✅ Verifica que el nodo "Respond to webhook" esté conectado
- ✅ Usa **"When last node finishes"** en el webhook

### Error 404 en curl
- ✅ El workflow debe estar Active
- ✅ Verifica que la ruta sea exacta: `procesar-ingrediente`

---

## 📱 Alternativa: Usar JSON Pre-configurado

Si tienes dificultades creando el workflow manualmente, aquí hay un JSON que puedes importar:

1. Ve a **File** → **Import from file**
2. Copia este contenido en un archivo `workflow.json`
3. Súbelo a n8n

```json
{
  "nodes": [
    {
      "parameters": {
        "path": "procesar-ingrediente",
        "responseCode": 200,
        "options": {}
      },
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {"name": "nombre", "value": "={{ $json.nombre }}"},
            {"name": "descripcion", "value": ""},
            {"name": "alergias", "value": ""},
            {"name": "intolerancias", "value": ""},
            {"name": "tipo", "value": ""},
            {"name": "origen", "value": ""},
            {"name": "organico", "value": false},
            {"name": "notas", "value": "Respuesta desde n8n"}
          ]
        }
      },
      "id": "set",
      "name": "Set",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [500, 300]
    },
    {
      "parameters": {
        "respondCode": 200
      },
      "id": "response",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [750, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "Set", "type": "main", "index": 0}]]
    },
    "Set": {
      "main": [[{"node": "Response", "type": "main", "index": 0}]]
    }
  }
}
```

---

## ✅ Checklist Final

- [ ] n8n está corriendo en http://localhost:5678
- [ ] Workflow creado y guardado
- [ ] Workflow está Active (toggle verde)
- [ ] Webhook URL copiada
- [ ] Prueba con curl funciona
- [ ] `.env` actualizado con N8N_WEBHOOK_INGREDIENTES
- [ ] Flask reiniciado
- [ ] Listo para procesar ingredientes

---

## 🎯 Próximo Paso

Una vez confirmado que el workflow funciona:

```bash
# En otra terminal
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar-todos \
  -H "Authorization: Bearer {token_jwt}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Esto procesará **TODOS** los ingredientes de la BD con n8n.
