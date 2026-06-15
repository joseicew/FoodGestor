# Herramientas Auxiliares

Esta carpeta contiene scripts de migración, debug y pruebas utilizados durante el desarrollo de FoodGestor.

## Archivos de Migración

Scripts ejecutados una sola vez para actualizar la estructura de la base de datos:

- `migrate_add_usuario_id.py` - Agrega campo usuario_id a tablas de alimentos y raciones
- `migrate_add_usuario_to_alimento.py` - Vincula alimentos a usuarios
- `migrate_add_macros_fields.py` - Agrega campos de macronutrientes
- `migrate_add_getd_field.py` - Agrega campo GETD (gasto energético)
- `migrate_add_peso_unidad.py` - Agrega campos peso y unidad de medida
- `migrate_fix_relations.py` - Corrige relaciones en la base de datos
- `migrate_both_databases.py` - Migra entre SQLite y PostgreSQL

## Herramientas de Limpieza

- `remove_usuario_id_from_alimento.py` - Remueve campo usuario_id (rollback)

## Herramientas de Debug

- `debug_insert.py` - Script para insertar datos de prueba

## Pruebas

- `test_consolidation.py` - Prueba la consolidación de ingredientes duplicados

## Uso

Estos scripts **no deben ser ejecutados en producción** sin revisar primero su contenido y hacer backup de la base de datos.

Las migraciones automáticas se ejecutan en `app/__init__.py` mediante la función `_migrar_columnas()`.
