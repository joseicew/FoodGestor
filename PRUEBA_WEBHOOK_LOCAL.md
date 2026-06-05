# Prueba del Webhook Local

## ✅ Configuración Lista

Se ha configurado un webhook de prueba local que simula el comportamiento de n8n sin necesidad de tener una instancia de n8n corriendo.

### Archivos Creados/Modificados:
1. ✅ `/backend/app/routes/test_webhook.py` - Webhook de prueba local
2. ✅ `/backend/app/__init__.py` - Registro del blueprint
3. ✅ `/backend/.env` - Configuración con webhook local

---

## 📚 Ingredientes de Prueba Disponibles

El webhook local tiene una BD simulada con estos ingredientes:

| Nombre | Tipo | Alergias | Intolerancias |
|---|---|---|---|
| **Nuez** | Fruto seco | Frutos secos | Histamina, Tiramina |
| **Leche** | Lácteo | Caseína, Lactosa | Lactosa |
| **Trigo** | Cereal | Gluten | Celiaquía |
| **Huevo** | Proteína | Proteína de huevo | - |
| **Plátano** | Fruta | - | Histamina (maduro) |
| **Espinaca** | Verdura | - | - |
| **Salmón** | Pescado | Pescado | Histamina |
| **Miel** | Endulzante | - | - |
| **Maní** | Legumbre | Maní/Cacahuete | Histamina |
| **Chocolate** | Dulce | Lactosa (con leche) | Histamina, Tiramina, Cafeína |

---

## 🚀 Pasos para la Prueba

### 1. Iniciar el Backend
```bash
cd backend
flask run
```

Deberías ver:
```
 * Running on http://127.0.0.1:5000
```

### 2. Verificar que el Webhook está Activo
```bash
curl http://localhost:5000/api/test/webhook-ingrediente/debug
```

Respuesta esperada:
```json
{
  "disponibles": ["nuez", "leche", "trigo", ...],
  "total": 10,
  "descripcion": "Base de datos simulada para pruebas del webhook"
}
```

### 3. Probar el Webhook con un Ingrediente
```bash
curl -X POST http://localhost:5000/api/test/webhook-ingrediente \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Nuez"}'
```

Respuesta esperada:
```json
{
  "nombre": "Nuez",
  "descripcion": "Fruto seco oleaginoso de alto valor nutricional...",
  "alergias": "frutos secos",
  "intolerancias": "histamina,tiramina",
  "tipo": "fruto seco",
  "origen": "América Central y Sudamérica",
  "organico": false,
  "notas": "Consumir con moderación..."
}
```

### 4. Obtener Token JWT

Primero, registra un usuario:
```bash
curl -X POST http://localhost:5000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

Respuesta:
```json
{
  "token": "eyJhbGc...",
  "usuario": { ... }
}
```

Copia el `token` (lo necesitarás para los próximos pasos).

### 5. Procesar UN Ingrediente Nuevo

```bash
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar \
  -H "Authorization: Bearer {tu_token}" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Nuez"}'
```

Respuesta esperada:
```json
{
  "mensaje": "Ingrediente creado exitosamente",
  "ingrediente": {
    "id": 1,
    "nombre": "Nuez",
    "descripcion": "Fruto seco oleaginoso de alto valor nutricional...",
    "alergias": "frutos secos",
    "intolerancias": "histamina,tiramina",
    "tipo": "fruto seco",
    "origen": "América Central y Sudamérica",
    "organico": false,
    "notas": "Consumir con moderación...",
    "fuente_datos": "n8n",
    "verificado": false,
    "created_at": "2026-06-02T...",
    "updated_at": "2026-06-02T..."
  }
}
```

### 6. Procesar TODOS los Ingredientes

```bash
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar-todos \
  -H "Authorization: Bearer {tu_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta esperada:
```json
{
  "mensaje": "Procesamiento completado: 10 actualizados, 0 con errores",
  "total_ingredientes": 10,
  "exitosos": 10,
  "errores": 0,
  "cambios": [
    {
      "nombre": "nuez",
      "cambios": {
        "descripcion": "Fruto seco oleaginoso...",
        "alergias": "frutos secos",
        "intolerancias": "histamina,tiramina",
        "tipo": "fruto seco",
        "origen": "América Central y Sudamérica",
        "fuente_datos": "n8n",
        "verificado": true
      }
    },
    ...
  ]
}
```

---

## 🎯 Escenarios de Prueba

### Escenario 1: Ingrediente Existente
```bash
# Primera vez - crea
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar \
  -H "Authorization: Bearer {token}" \
  -d '{"nombre": "Leche"}'
# Respuesta: 201 Created

# Segunda vez - retorna existente
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar \
  -H "Authorization: Bearer {token}" \
  -d '{"nombre": "Leche"}'
# Respuesta: 200 OK (ya existe)
```

### Escenario 2: Ingrediente no en BD de Prueba
```bash
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar \
  -H "Authorization: Bearer {token}" \
  -d '{"nombre": "Quinoa"}'
```

Respuesta: Crea el ingrediente con campos vacíos (valores por defecto)
```json
{
  "nombre": "Quinoa",
  "descripcion": "",
  "alergias": "",
  "tipo": "",
  "fuente_datos": "n8n",
  "verificado": false
}
```

### Escenario 3: Procesar Todos
Procesa los 10 ingredientes de la BD simulada y rellena todos los campos.

---

## 📊 Verificar Resultados en la BD

```bash
# Ver todos los ingredientes creados
sqlite3 backend/foodgestor.db "SELECT nombre, tipo, alergias, fuente_datos FROM ingrediente LIMIT 5;"

# Ver ingredientes procesados por n8n
sqlite3 backend/foodgestor.db "SELECT nombre, tipo, alergias FROM ingrediente WHERE fuente_datos = 'n8n' LIMIT 5;"

# Ver total de ingredientes
sqlite3 backend/foodgestor.db "SELECT COUNT(*) FROM ingrediente;"
```

---

## ✅ Checklist de Prueba

- [ ] Backend corriendo en http://localhost:5000
- [ ] Webhook de prueba accesible en `/api/test/webhook-ingrediente`
- [ ] Webhook retorna datos correcto para "Nuez"
- [ ] Usuario registrado con token JWT
- [ ] Procesar un ingrediente individual funciona
- [ ] Procesar todos los ingredientes funciona
- [ ] Ingredientes se crean en la BD correctamente
- [ ] Campos de alergias/intolerancias se rellenan
- [ ] `fuente_datos: 'n8n'` está configurado
- [ ] `verificado: true/false` está configurado

---

## 🔄 Flujo Completo de Prueba (Paso a Paso)

```bash
# 1. Inicia backend en otra terminal
cd backend && flask run

# 2. Verifica webhook
curl http://localhost:5000/api/test/webhook-ingrediente/debug

# 3. Registra usuario
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Password123"}' | jq -r '.token')

# 4. Procesa un ingrediente
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Nuez"}'

# 5. Procesa todos
curl -X POST http://localhost:5000/api/alimentos/ingredientes/procesar-todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# 6. Verifica en BD
sqlite3 backend/foodgestor.db "SELECT nombre, tipo, alergias FROM ingrediente LIMIT 10;"
```

---

## 🚨 Troubleshooting

### Error: "ConnectionRefusedError"
- **Causa**: Backend no está corriendo
- **Solución**: Ejecuta `flask run` en la carpeta backend

### Error: "Unauthorized"
- **Causa**: Token JWT no válido o expirado
- **Solución**: Obtén un token nuevo con el endpoint de registro

### Error: "Webhook not found"
- **Causa**: test_webhook_bp no está registrado
- **Solución**: Verifica que `__init__.py` tenga el import y registro

### Campos vacíos en BD
- **Causa**: Ingrediente no está en BD simulada
- **Solución**: Agrégalo a `test_webhook.py` en `INGREDIENTES_DB`

---

## 📝 Notas

- El webhook de prueba usa una BD simulada (diccionario Python)
- No persiste datos entre reinicios
- Ideal para testing y desarrollo
- Una vez en producción, reemplazar con URL de n8n real
- Todos los 10 ingredientes tienen datos completos para prueba
