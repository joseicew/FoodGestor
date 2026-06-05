# Guía Rápida: Auto-Save ⚡

## TL;DR (Versión Corta)

**El sistema ahora guarda alimentos automáticamente mientras escribes. No necesitas hacer clic en nada.**

---

## Cómo Usar

### 1. Abre la app
```
http://localhost:4200
```

### 2. Ve a la pestaña "Añadir"

### 3. Llena el formulario
```
Nombre:      "Pollo a la Plancha"
Marca:       "Carrefour"
Calorías:    165
Categoría:   "Carnes y Aves"
```

### 4. ¡ESPERA 2 SEGUNDOS!
```
La app automáticamente:
✓ Guarda en la BD
✓ Muestra "Guardado ✓"
✓ Limpia el formulario
✓ Carga la lista actualizada
```

---

## Indicadores Visuales

### Mientras se guarda
```
✓ Nombre guardado
├─ 🔄 Guardando... ← Ves esto mientras se guarda
└─ (2 segundos)
```

### Después de guardar
```
✓ Nombre guardado
└─ ✓ Guardado ← Ves este mensaje de éxito
```

---

## Campos Obligatorios

Para que se guarde automáticamente, completa estos 4:
1. ✅ **Nombre** - Ej: "Pollo"
2. ✅ **Marca** - Ej: "Hacendado"
3. ✅ **Calorías** - Ej: 165
4. ✅ **Categoría** - Ej: "Carnes y Aves"

Todos los demás son **opcionales**.

---

## Verificación Rápida

### ¿Se guardó?
- Verás el mensaje "Guardado ✓"
- El formulario se limpiará automáticamente

### ¿No aparece en la lista?
Haz clic en: **🔄 Sincronizar** (esquina superior derecha)

---

## Si Algo Falla

### Error: "Ya existe"
→ El nombre o código de barras ya está guardado
→ Cambia el nombre o código

### No se guarda
→ Asegúrate de que los 4 campos obligatorios estén llenos
→ Espera 2 segundos después de escribir

### Aún no aparece
→ Haz clic en el botón 🔄 Sincronizar
→ O recarga la página (F5)

---

## Comparativa: Antes vs Después

| Acción | Antes | Después |
|--------|-------|---------|
| Crear alimento | Click "Crear" + confirmar + ver modal | Automático ✓ |
| Tiempo | 5-10 segundos | 2 segundos (sin acciones) |
| Confirmaciones | 2-3 modales | Ninguna |
| Siguiente alimento | Manual reset | Automático reset |

---

## Ejemplo Real

```
⏱️ TIEMPO

0s    Empiezo a escribir "Arroz integral"
      [escribo el nombre]

5s    Escribo la marca "Carrefour"
      [escribo la marca]

12s   Escribo las calorías "100"
      [escribo calorías]

18s   Selecciono categoría "Cereales"
      [selecciono en dropdown]

20s   👀 VEMOS "🔄 Guardando..."
      [se envía al servidor]

22s   ✅ "✓ Guardado"
      [aparece en la lista automáticamente]

25s   El formulario se limpia
      [listo para el siguiente]
```

---

## Teclas de Atajo

| Acción | Botón |
|--------|-------|
| Recargar lista | 🔄 Sincronizar (esquina superior) |
| Limpiar formulario | Automático después de guardar |
| Ver consola | F12 → Console (para debugging) |

---

## Documentación Completa

Para más detalles, lee:
- 📄 **`AUTO_SAVE_EXPLICACION.md`** - Cómo funciona (técnico)
- 📄 **`CAMBIOS_AUTO_SAVE.md`** - Qué se modificó (desarrolladores)
- 📄 **`SINCRONIZACION_DATOS.md`** - Sincronización general

---

## Preguntas Frecuentes

**P: ¿Dónde se guardan los datos?**
R: En `backend/instance/foodgestor.db`

**P: ¿Se puede desactivar el auto-save?**
R: Sí, edita `alimentos.ts` y comenta la función `dispararAutoSave()`

**P: ¿Qué pasa si cierro la app antes de que guarde?**
R: Si espera 2 segundos, el alimento se guardrá. Si cierras antes, se pierde.

**P: ¿Puedo crear múltiples alimentos rápido?**
R: Sí, el formulario se limpia automáticamente después de cada guardado.

**P: ¿Cómo veo si algo falló?**
R: Abre la consola (F12) y verás mensajes como "Error en auto-save: ..."

---

## Resumen

✅ **Automático** - Se guarda sin que hagas nada
✅ **Rápido** - 2 segundos después de escribir
✅ **Confiable** - Validaciones incluidas
✅ **Visual** - Ves "Guardando..." y "Guardado ✓"

**¡Simplemente escribe y deja que el sistema haga el resto!**
