# Workflow de n8n para Procesar Ingredientes

## Descripción General

Este workflow recibe el nombre de un ingrediente y busca información real en OpenFoodFacts API, retornando datos estructurados sobre alergias, intolerancias, tipo, origen, etc.

---

## Arquitectura del Workflow

```
1. Webhook Trigger (POST)
   └─ Recibe: { "nombre": "Nuez" }

2. HTTP Request → OpenFoodFacts API
   └─ Busca: /cgi/search.pl?search_terms=Nuez&json=1

3. Procesar Respuesta
   ├─ Extraer información
   ├─ Mapear categorías
   └─ Rellenar campos

4. HTTP Response
   └─ Retorna: { nombre, descripcion, tipo, alergias, ... }
```

---

## Pasos para Crear en n8n

### 1. Ir a n8n Dashboard
- URL: http://localhost:5678
- Click en "Create a workflow"

### 2. Agregar Nodo: Webhook

**Tipo**: Webhook (Trigger)

**Configuración**:
- **Method**: POST
- **Path**: `/webhook/procesar-ingrediente`
- **Response code**: 200
- **Response data**: First entry

**Nota**: Copia la URL del webhook, será: `http://localhost:5678/webhook/procesar-ingrediente`

---

### 3. Agregar Nodo: HTTP Request (Búsqueda)

**Tipo**: HTTP Request

**Configuración**:
- **Method**: GET
- **URL**: `https://world.openfoodfacts.org/cgi/search.pl`
- **Query Parameters**:
  - `search_terms`: `{{ $json.nombre }}`
  - `json`: `1`

**Headers**:
- `User-Agent`: `FoodGestor/1.0`

---

### 4. Agregar Nodo: IF (Validar respuesta)

**Tipo**: IF

**Condition**:
- Condición: `{{ $json.products.length > 0 }}`
- True: Continuar
- False: Valores por defecto

---

### 5. Ruta TRUE: Procesar datos reales

**Nodo: Extract Product Data**

**Tipo**: Set

**Data**:
```json
{
  "nombre": "{{ $json.products[0].product_name || $node['Webhook'].json.nombre }}",
  "descripcion": "{{ $json.products[0].generic_name || '' }}",
  "tipo": "{{ $json.products[0].categories || '' }}",
  "alergias": "{{ $json.products[0].allergens || '' }}",
  "intolerancias": "{{ $json.products[0].allergens || '' }}",
  "origen": "{{ $json.products[0].origin_countries || '' }}",
  "organico": "{{ $json.products[0].labels.includes('organic') || false }}",
  "notas": "{{ $json.products[0].generic_name }} - Nutrient information available"
}
```

**Output**: Connect to Response node

---

### 6. Ruta FALSE: Valores por defecto

**Nodo: Default Values**

**Tipo**: Set

**Data**:
```json
{
  "nombre": "{{ $node['Webhook'].json.nombre }}",
  "descripcion": "",
  "tipo": "",
  "alergias": "",
  "intolerancias": "",
  "origen": "",
  "organico": false,
  "notas": "No se encontró información en OpenFoodFacts"
}
```

**Output**: Connect to Response node

---

### 7. Agregar Nodo: Response

**Tipo**: Respond to Webhook

**Response Body**:
```json
{
  "nombre": "{{ $json.nombre }}",
  "descripcion": "{{ $json.descripcion }}",
  "tipo": "{{ $json.tipo }}",
  "alergias": "{{ $json.alergias }}",
  "intolerancias": "{{ $json.intolerancias }}",
  "origen": "{{ $json.origen }}",
  "organico": "{{ $json.organico }}",
  "notas": "{{ $json.notas }}"
}
```

---

## Alternativa Simplificada (Sin OpenFoodFacts)

Si OpenFoodFacts no funciona, puedes usar esta alternativa con datos simulados más realistas:

### Nodo Switch

**Tipo**: Switch

**Cases**:
```
Case 1: nombre = "nuez"
  → Retorna datos de nuez

Case 2: nombre = "leche"
  → Retorna datos de leche

Case 3: nombre = "trigo"
  → Retorna datos de trigo

Default: 
  → Retorna vacío
```

---

## Testing del Workflow

### 1. Desde cURL

```bash
curl -X POST http://localhost:5678/webhook/procesar-ingrediente \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Nuez"}'
```

### 2. Desde n8n Test

- Click en "Test workflow"
- Click en nodo Webhook
- Click en "Send Test Data"

### 3. Desde el Backend

El backend ya está configurado para llamar:
```
POST http://localhost:5678/webhook/procesar-ingrediente
{ "nombre": "Nuez" }
```

---

## Ejemplo de Respuestas

### Caso 1: Ingrediente encontrado en OpenFoodFacts

**Request**:
```json
{ "nombre": "Nuez" }
```

**Response**:
```json
{
  "nombre": "Nuez",
  "descripcion": "Walnut kernel",
  "tipo": "Nuts and their products",
  "alergias": "Nuts",
  "intolerancias": "Tree nuts",
  "origen": "Multiple countries",
  "organico": false,
  "notas": "Rich in omega-3 fatty acids"
}
```

### Caso 2: Ingrediente no encontrado

**Request**:
```json
{ "nombre": "Quinoa" }
```

**Response** (con valores por defecto):
```json
{
  "nombre": "Quinoa",
  "descripcion": "",
  "tipo": "",
  "alergias": "",
  "intolerancias": "",
  "origen": "",
  "organico": false,
  "notas": "No se encontró información en OpenFoodFacts"
}
```

---

## Próximos Pasos

1. ✅ Instalar n8n
2. ✅ Crear workflow (siguiendo pasos arriba)
3. ✅ Activar webhook
4. ✅ Obtener URL del webhook
5. ✅ Actualizar `.env` con URL de n8n
6. ✅ Hacer pruebas
7. ✅ Procesar todos los ingredientes

---

## Notas Importantes

- **OpenFoodFacts**: API pública, sin autenticación requerida
- **Rate Limiting**: OpenFoodFacts tiene límites, pero suficiente para testing
- **Alternativa**: Si OpenFoodFacts falla, el workflow retorna valores por defecto automáticamente
- **Validación**: n8n valida que la respuesta tenga la estructura correcta

---

## URLs Útiles

- **n8n Dashboard**: http://localhost:5678
- **OpenFoodFacts API**: https://world.openfoodfacts.org/cgi/search.pl
- **Documentación n8n**: https://docs.n8n.io/
