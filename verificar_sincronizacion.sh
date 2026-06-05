#!/bin/bash

echo "=========================================="
echo "VERIFICAR SINCRONIZACIÓN DE FOODGESTOR"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar backend
echo "1. Verificando Backend..."
if curl -s http://localhost:5000/api/alimentos/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend está corriendo${NC}"
else
    echo -e "${RED}✗ Backend NO está disponible${NC}"
    echo "  Inicia el backend con: cd backend && python main.py"
    exit 1
fi

echo ""

# 2. Verificar frontend
echo "2. Verificando Frontend..."
if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend está corriendo${NC}"
else
    echo -e "${YELLOW}⚠ Frontend NO está disponible${NC}"
    echo "  Puedes iniciar con: cd frontend && ng serve"
fi

echo ""

# 3. Contar alimentos en BD
echo "3. Alimentos en Base de Datos:"
cd backend 2>/dev/null
ALIMENTOS_BD=$(python3 << 'EOF' 2>/dev/null
import sqlite3
try:
    db = sqlite3.connect('instance/foodgestor.db')
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) FROM alimento")
    print(cursor.fetchone()[0])
    db.close()
except:
    print("0")
EOF
)

if [ "$ALIMENTOS_BD" -gt 0 ]; then
    echo -e "${GREEN}✓ BD tiene $ALIMENTOS_BD alimentos${NC}"
else
    echo -e "${YELLOW}⚠ BD está vacía${NC}"
fi

echo ""

# 4. Verificar API
echo "4. Alimentos desde API:"
ALIMENTOS_API=$(curl -s http://localhost:5000/api/alimentos/ 2>/dev/null | python3 -c "import json, sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$ALIMENTOS_API" -gt 0 ]; then
    echo -e "${GREEN}✓ API devuelve $ALIMENTOS_API alimentos${NC}"
else
    echo -e "${YELLOW}⚠ API no devuelve datos${NC}"
fi

echo ""

# 5. Verificar sincronización
echo "5. Sincronización:"
if [ "$ALIMENTOS_BD" -eq "$ALIMENTOS_API" ]; then
    echo -e "${GREEN}✓ BD y API tienen los mismos datos${NC}"
else
    echo -e "${YELLOW}⚠ Hay discrepancia entre BD ($ALIMENTOS_BD) y API ($ALIMENTOS_API)${NC}"
fi

echo ""
echo "=========================================="
echo "RESUMEN"
echo "=========================================="
echo "Backend:    $(curl -s http://localhost:5000/api/alimentos/ > /dev/null 2>&1 && echo 'Corriendo' || echo 'Parado')"
echo "Frontend:   $(curl -s http://localhost:4200 > /dev/null 2>&1 && echo 'Corriendo' || echo 'Parado')"
echo "BD:         $ALIMENTOS_BD alimentos"
echo "API:        $ALIMENTOS_API alimentos"
echo "Estado:     $([ "$ALIMENTOS_BD" -eq "$ALIMENTOS_API" ] && echo 'SINCRONIZADO ✓' || echo 'DESINCRONIZADO ✗')"
echo "=========================================="
