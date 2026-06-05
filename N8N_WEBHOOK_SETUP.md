# Configuración del Webhook de n8n para Procesamiento de Ingredientes

## Resumen

Cuando un usuario añade un **ingrediente nuevo** manualmente en el popup de detalles del alimento, el sistema ahora:

1. ✅ Llama al endpoint `POST /api/alimentos/ingredientes/procesar` con el nombre
2. ✅ El backend invoca un webhook de n8n
3. ⏳ **n8n busca información sobre el ingrediente** (alergias, intolerancias, tipo, etc.)
4. ✅ El backend recibe los datos y crea el ingrediente en la BD

El webhook de n8n es el paso **⏳** que aún falta configurar.

---

## Estructura del Webhook en n8n

### Input (lo que recibe desde el backend)
```json
{
  "nombre": "Nuez"
}
```

### Output (lo que debe retornar)
```json
{
  "nombre": "Nuez",
  "descripcion": "Fruto seco oleaginoso de alto valor nutricional",
  "alergias": "frutos secos",
  "intolerancias": "histamina,tiramina",
  "tipo": "fruto seco",
  "origen": "diversos países",
  "organico": false,
  "notas": "Contiene ácido fítico, consumir con moderación"
}
```

### Campos esperados:
- **nombre** (string): Nombre del ingrediente (normalizado)
- **descripcion** (string): Descripción breve
- **alergias** (string): CSV de alergias comunes (ej: "gluten,frutos secos,marisco")
- **intolerancias** (string): CSV de intolerancias (ej: "lactosa,histamina")
- **tipo** (string): Categoría (ej: "fruto seco", "cereal", "legumbre", "verdura", "fruta", "carne", "lácteo")
- **origen** (string): País/región de origen
- **organico** (boolean): Si es producto ecológico
- **notas** (string): Anotaciones adicionales, información especial, etc.

---

## Flujo en n8n que debes crear

```
1. Webhook Trigger
   ├─ Recibe POST /webhook/procesar-ingrediente
   └─ Espera: { "nombre": "..." }

2. HTTP Request (opcional: búsqueda en API externa)
   ├─ Buscar en OpenFoodFacts, Google, o BD local
   └─ Extraer información

3. Switch Node (opcional: lógica condicional)
   ├─ Si encontró información → usar datos
   └─ Si no → asignar valores por defecto

4. HTTP Response
   └─ Retornar JSON con los campos esperados
```

---

## Ejemplo con OpenFoodFacts API (opcional)

Si quieres buscar en OpenFoodFacts, puedes usar un flujo como este:

```
1. Webhook Trigger
   └─ Input: { "nombre": "Nuez" }

2. HTTP Request to OpenFoodFacts
   ├─ URL: https://world.openfoodfacts.org/cgi/search.pl?search_terms={{$json.nombre}}&json=1
   └─ Parse response to extract info

3. Format Response
   ├─ nombre: use input name
   ├─ descripcion: extract from OpenFoodFacts
   ├─ alergias: hardcoded or from data
   ├─ intolerancias: hardcoded or from data
   ├─ tipo: map from OpenFoodFacts category
   ├─ origen: extract from data
   └─ organico: check if eco label exists

4. HTTP Response (return JSON)
```

---

## Alternativa Simple (sin API externa)

Si prefieres una solución simple sin APIs externas, puedes:

```
1. Webhook Trigger
   └─ Input: { "nombre": "..." }

2. Switch/Lookup Table
   ├─ "Nuez" → { descripcion: "...", tipo: "fruto seco", alergias: "frutos secos", ... }
   ├─ "Leche" → { descripcion: "...", tipo: "lácteo", alergias: "lactosa", ... }
   └─ default → { descripcion: "", tipo: "", alergias: "", ... }

3. HTTP Response
   └─ Return formatted data
```

---

## Configuración en el Backend

El `.env` ya tiene la variable:
```
N8N_WEBHOOK_INGREDIENTES=https://tu-n8n-instance.com/webhook/procesar-ingrediente
```

Cambia la URL por la URL real de tu webhook en n8n.

---

## Test en el Frontend

Una vez configurado el webhook en n8n:

1. Abre el popup de detalles de un alimento (Buscar/Favoritos/Actualizar)
2. Haz click en el botón **"+ Editar"** junto a "Ingredientes"
3. Busca un ingrediente que **no exista** en la BD
4. Escribe el nombre (ej: "Espinaca")
5. El sistema llamará a n8n automáticamente
6. Verifica que se cree el ingrediente con los datos procesados

---

## Notas Importantes

- Si el webhook tarda más de 10 segundos, la llamada se cancela (timeout)
- Si el webhook falla o retorna error, se crea el ingrediente con valores por defecto
- El ingrediente se marca como `fuente_datos: "n8n"` para auditoría
- El campo `verificado: false` indica que aún no fue verificado manualmente

---

## Próximos Pasos

1. Crear el webhook en n8n (ver ejemplos arriba)
2. Obtener la URL pública del webhook
3. Actualizar `N8N_WEBHOOK_INGREDIENTES` en `.env`
4. Reiniciar el backend: `flask run`
5. Probar desde el frontend
