# Procesamiento Masivo de Ingredientes con n8n

## Descripción

El nuevo endpoint `POST /api/alimentos/ingredientes/procesar-todos` permite procesar **TODOS los ingredientes existentes en la base de datos** a través del webhook de n8n en una sola operación.

Este es el flujo para llenar automáticamente los campos:
- `descripcion`
- `alergias`
- `intolerancias`
- `tipo`
- `origen`
- `organico`
- `notas`

---

## Endpoint

```
POST /api/alimentos/ingredientes/procesar-todos
Authorization: Bearer {token_jwt}
Content-Type: application/json
Body: {} (vacío)
```

---

## Respuesta

```json
{
  "mensaje": "Procesamiento completado: 45 actualizados, 2 con errores",
  "total_ingredientes": 47,
  "exitosos": 45,
  "errores": 2,
  "cambios": [
    {
      "nombre": "Nuez",
      "cambios": {
        "descripcion": "Fruto seco oleaginoso...",
        "alergias": "frutos secos",
        "intolerancias": "histamina",
        "tipo": "fruto seco",
        "origen": "diversos países",
        "fuente_datos": "n8n",
        "verificado": true
      }
    },
    {
      "nombre": "Leche",
      "cambios": {
        "descripcion": "Líquido nutritivo de origen animal...",
        "alergias": "lactosa",
        "tipo": "lácteo",
        "fuente_datos": "n8n",
        "verificado": true
      }
    },
    {
      "nombre": "Ingrediente Fallido",
      "error": "Timeout al conectar con n8n"
    }
  ]
}
```

---

## Cómo Usar

### Opción 1: Desde cURL

```bash
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar-todos \
  -H "Authorization: Bearer {tu_token_jwt}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Opción 2: Desde el Frontend (Angular)

```typescript
// En el componente
constructor(private alimentosService: AlimentosService) {}

procesarTodosLosIngredientes() {
  this.alimentosService.procesarTodosLosIngredientes().subscribe(
    (respuesta) => {
      console.log('Procesamiento completado:');
      console.log(`Exitosos: ${respuesta.exitosos}`);
      console.log(`Errores: ${respuesta.errores}`);
      console.log(`Total: ${respuesta.total_ingredientes}`);
      
      // Mostrar detalles de cambios
      respuesta.cambios.forEach((cambio: any) => {
        console.log(`${cambio.nombre}: ${JSON.stringify(cambio.cambios || cambio.error)}`);
      });
    },
    (error) => {
      console.error('Error procesando ingredientes:', error);
    }
  );
}
```

### Opción 3: Agregar un Botón en el Admin Panel

```html
<button (click)="procesarTodosLosIngredientes()" class="btn btn-warning">
  🔄 Procesar Todos los Ingredientes
</button>
```

---

## Lógica del Procesamiento

### Para cada ingrediente:

1. **Obtiene el nombre del ingrediente**
2. **Llama a n8n** con: `{ "nombre": "..." }`
3. **Recibe respuesta** con datos del ingrediente
4. **Actualiza SOLO campos vacíos**
   - Si el ingrediente YA tiene `descripcion`, NO la sobrescribe
   - Si ya tiene `alergias`, NO las sobrescribe
   - Y así para todos los campos

5. **Marca como verificado** si fue procesado por n8n
6. **Registra cambios** para el reporte

### Si hay error en un ingrediente:
- Se captura el error
- Se incrementa el contador de errores
- Se continúa con el siguiente ingrediente
- No afecta a los demás

---

## Seguridad

- ✅ Requiere token JWT (`@jwt_required()`)
- ✅ Solo usuarios autenticados pueden ejecutar
- ✅ No modifica datos existentes (solo agrega)
- ✅ No elimina nada
- ✅ Genera reporte detallado

---

## Comportamiento Detallado

### Campos que SE actualizan (si están vacíos):
```python
if datos_procesados.get('descripcion') and not ingrediente.descripcion:
    ingrediente.descripcion = datos_procesados['descripcion']
```

**Esto significa:**
- ✅ Si n8n retorna descripcion Y el ingrediente no tiene → actualiza
- ❌ Si n8n retorna descripcion PERO el ingrediente ya tiene → NO cambia
- ❌ Si n8n no retorna nada → no hace nada

### Campo que SIEMPRE se actualiza:
```python
if datos_procesados.get('fuente_datos') == 'n8n':
    ingrediente.fuente_datos = 'n8n'
    ingrediente.verificado = True
```

Esto permite auditar qué ingredientes fueron procesados por n8n.

---

## Ejemplo de Ejecución

### Entrada:
```
Base de datos tiene 50 ingredientes sin procesar
```

### Procesamiento:
```
1. Nuez → n8n → Retorna datos ✅
2. Leche → n8n → Retorna datos ✅
3. Gluten → n8n → Timeout ❌
4. Huevo → n8n → Retorna datos ✅
...
```

### Salida:
```json
{
  "total_ingredientes": 50,
  "exitosos": 48,
  "errores": 2,
  "cambios": [
    { "nombre": "Nuez", "cambios": {...} },
    { "nombre": "Leche", "cambios": {...} },
    { "nombre": "Gluten", "error": "Timeout..." },
    ...
  ]
}
```

---

## Errores Comunes

### Error: "No hay ingredientes para procesar"
- **Causa**: La BD está vacía
- **Solución**: Crear ingredientes primero

### Error: "Webhook n8n no configurado"
- **Causa**: `N8N_WEBHOOK_INGREDIENTES` en `.env` no está configurada
- **Solución**: Actualizar `.env` con la URL del webhook
- **Resultado**: Los ingredientes se crean con `fuente_datos: "manual"`

### Error: "Timeout al conectar con n8n"
- **Causa**: n8n tardó más de 10 segundos
- **Solución**: 
  - Verificar que n8n esté running
  - Verificar conexión de red
  - Aumentar timeout en `n8n_service.py` si es necesario

---

## Próximos Pasos

1. **Configurar webhook en n8n** (ver `N8N_WEBHOOK_SETUP.md`)
2. **Obtener URL del webhook**
3. **Actualizar `.env`** con: `N8N_WEBHOOK_INGREDIENTES=https://...`
4. **Reiniciar backend**: `flask run`
5. **Ejecutar procesamiento**:
   ```bash
   # Desde cURL o frontend
   POST /api/alimentos/ingredientes/procesar-todos
   ```
6. **Revisar reporte** de cambios realizados

---

## Monitoreo

Después de ejecutar, puedes verificar los cambios:

```sql
-- Ingredientes procesados por n8n
SELECT nombre, fuente_datos, verificado, alergias, intolerancias 
FROM ingrediente 
WHERE fuente_datos = 'n8n' AND verificado = true;

-- Ingredientes sin procesar
SELECT nombre, fuente_datos, verificado, alergias, intolerancias 
FROM ingrediente 
WHERE fuente_datos != 'n8n' OR verificado = false;
```

---

## Performance

- ⚡ Si tienes 50 ingredientes y n8n tarda 1s por cada uno → **~50 segundos totales**
- 🔄 El sistema procesa **secuencialmente** (uno por uno)
- 💾 Genera **un solo COMMIT** al final (todo o nada)
- 📊 Retorna un reporte **completo** al terminar

Si necesitas paralelizar, podemos agregar un sistema de colas (Celery, RQ) en el futuro.

---

## Reversión

Si algo sale mal:

```sql
-- Revertir cambios (si es necesario)
UPDATE ingrediente 
SET fuente_datos = 'manual', verificado = false 
WHERE fuente_datos = 'n8n';
```

O usar `git` si es necesario volver a una versión anterior de la BD.
