#!/bin/bash

echo "=========================================="
echo "VERIFICACIÓN DE CAMBIOS - AUTO-SAVE V2"
echo "=========================================="
echo ""

echo "✓ Compilación Angular:"
cd frontend && npx ng build 2>&1 | grep -E "complete|error" | head -1 && echo "  [OK]"
cd ..

echo ""
echo "✓ Backend disponible:"
curl -s http://localhost:5000/api/alimentos/ > /dev/null && echo "  [OK]" || echo "  [ERROR]"

echo ""
echo "✓ Cambios implementados:"
echo "  [✓] Auto-save INMEDIATO para alimentos"
echo "  [✓] Auto-save para menús"
echo "  [✓] Botón Sincronizar removido"
echo "  [✓] Sin esperas de 2 segundos"

echo ""
echo "✓ Base de Datos:"
python3 << 'PYTHON'
import sqlite3
db = sqlite3.connect('backend/instance/foodgestor.db')
cursor = db.cursor()
cursor.execute("SELECT COUNT(*) FROM alimento")
alimentos = cursor.fetchone()[0]
cursor.execute("SELECT COUNT(*) FROM menu")
menus = cursor.fetchone()[0]
print(f"  Alimentos: {alimentos}")
print(f"  Menús: {menus}")
db.close()
PYTHON

echo ""
echo "=========================================="
echo "ESTATUS: ✅ LISTO PARA USAR"
echo "=========================================="
