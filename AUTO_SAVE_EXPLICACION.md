# Auto-Save: Guardado Automático de Alimentos

## ¿Qué es el Auto-Save?

El **Auto-Save** es una característica que guarda automáticamente los alimentos en la base de datos mientras los estás creando, **sin necesidad de hacer clic en ningún botón**.

## Cómo Funciona

### 1. **Iniciación Automática**
Cuando abres la app:
- ✅ Los alimentos se cargan automáticamente
- ✅ El formulario está listo para llenar

### 2. **Guardado Automático**
Mientras rellenas el formulario:
1. **Escribes en los campos** (nombre, marca, calorías, etc.)
2. **Esperas 2 segundos** sin escribir
3. **Automáticamente se guarda** en la BD si los campos obligatorios están completos

### 3. **Indicador Visual**
Verás un indicador en tiempo real:
- ⏳ **"Guardando..."** - Se está guardando en la BD
- ✅ **"Guardado"** - Guardado exitosamente

## Campos Obligatorios

Para que se guarde automáticamente, debes completar:
1. ✅ **Nombre** - Ej: "Pechuga de pollo"
2. ✅ **Marca** - Ej: "Carrefour"
3. ✅ **Calorías** - Mayor a 0
4. ✅ **Categoría** - Una de las listadas

Los demás campos son opcionales.

## Flujo Paso a Paso

### Ejemplo: Crear "Pollo a la Plancha"

```
1. Escribes: Nombre = "Pollo a la Plancha"
   → Auto-save se arma (timeout de 2 segundos)

2. Escribes: Marca = "Carrefour"
   → Auto-save se reinicia (2 segundos más)

3. Escribes: Calorías = "165"
   → Auto-save se reinicia (2 segundos más)

4. Seleccionas: Categoría = "Carnes y Aves"
   → Todos los campos obligatorios están completos
   
5. ESPERAS 2 SEGUNDOS SIN ESCRIBIR
   → ¡AUTO-SAVE SE EJECUTA! ✅
   
6. Ves el mensaje: "✓ Pollo a la Plancha guardado automáticamente"
   
7. El formulario se limpia automáticamente
   → Listo para crear otro alimento
```

## Verificación

### En la Consola del Navegador (F12)
Verás logs como:
```
Auto-guardado: Pollo a la Plancha
```

### En la Base de Datos
El alimento aparece inmediatamente:
```bash
curl http://localhost:5000/api/alimentos/ | grep "Pollo"
```

## Ventajas del Auto-Save

| Ventaja | Descripción |
|---------|------------|
| **Sin clicks** | No necesitas botones de guardar |
| **Sincronización instantánea** | Se guarda en BD mientras escribes |
| **Feedback visual** | Ves exactamente qué está pasando |
| **Sin perder datos** | Si cierras el navegador, el alimento está guardado |
| **Múltiples alimentos** | Puedes crear varios sin interrupciones |

## Si Algo Va Mal

### "No veo 'Guardado ✓'"
- ✅ Asegúrate de que Nombre, Marca, Calorías y Categoría estén completos
- ✅ Espera 2 segundos después de escribir
- ✅ Abre la consola (F12) para ver qué error hay

### "No aparece en la lista"
- ✅ Haz clic en "🔄 Sincronizar" en la esquina superior derecha
- ✅ O recarga la página (F5)
- ✅ O cambia a otra pestaña y vuelve a "Buscar"

### "Dice 'Ya existe'"
- ✅ El nombre o código de barras ya está en la BD
- ✅ Cambia el nombre o código
- ✅ El sistema lo detección automáticamente

## Diferencia: Auto-Save vs Manual

### Antes (Sin Auto-Save)
1. Llenar formulario
2. Hacer clic en "Crear Alimento"
3. Confirmar si hay similares
4. Ver modal de éxito
5. Cerrar modal

### Ahora (Con Auto-Save)
1. Llenar formulario
2. **¡Automáticamente guardado!** ✅
3. Ver "Guardado ✓"
4. Formulario se limpia
5. **Listo para siguiente alimento**

## Configuración (Avanzado)

Si quieres ajustar el tiempo de espera, edita `alimentos.ts`:

```typescript
// Línea ~340: cambiar de 2000 a otro valor en milisegundos
setTimeout(() => {
  if (this.formularioValido && !this.nombreDuplicado && !this.codigoDuplicado) {
    this.guardarAlimentoAutomaticamente();
  }
}, 2000);  // 2000 = 2 segundos. Cambiar a 1000 (1 seg) o 3000 (3 seg)
```

## Estados del Auto-Save

### `estadoAutoSave`
- `'idle'` - Esperando cambios
- `'guardando'` - Enviando datos al servidor
- `'guardado'` - Guardado exitosamente ✓
- `'error'` - Hubo un error

## Debugging

### Ver logs en consola
```javascript
// Abre consola (F12) → Tab "Console"
// Verás mensajes como:
"Auto-guardado: Pechuga de pollo"
"Error en auto-save: ..."
```

### Verificar en BD
```bash
cd backend
sqlite3 instance/foodgestor.db "SELECT nombre, marca FROM alimento ORDER BY id DESC LIMIT 5;"
```

## Casos de Uso

### ✅ Funciona bien
- Llenar un formulario lentamente
- Escribir entre OCR
- Agregar fotos
- Cambiar valores

### ⚠️ Casos especiales
- **Duplicados**: Si el alimento ya existe, muestra error y no guarda
- **Formulario incompleto**: Si faltan campos obligatorios, espera
- **Error del servidor**: Reintentos automáticos (próxima versión)

## Resumen

**El auto-save convierte la creación de alimentos en un proceso fluido:**

1. Escribes datos
2. **Automáticamente se guardan**
3. Ves confirmación visual
4. Repites para más alimentos

Sin botones, sin modales, sin esperas innecesarias. ✓
