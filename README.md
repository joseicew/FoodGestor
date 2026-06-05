# FoodGestor - REST API

Sistema de gestión de alimentos y pedidos con Flask y SQLite.

## Descripción del Proyecto

**FoodGestor** es una REST API desarrollada con Flask que permite gestionar productos y órdenes de un sistema de comida. Utiliza SQLite como base de datos (perfecta para desarrollo) y sigue una arquitectura modular y escalable.

## Características

- ✅ CRUD completo de Alimentos con macros
- ✅ Gestión de ingredientes con propiedades (alérgenos, aditivos, intolerancias)
- ✅ Múltiples códigos de búsqueda por alimento (EAN, UPC, SKU)
- ✅ Relaciones N:M entre alimentos e ingredientes
- ✅ Filtros avanzados (alérgenos, aditivos, intolerancias)
- ✅ Búsqueda por código
- ✅ Información nutricional completa
- ✅ Propiedades vegetariano/vegano
- ✅ Estructura modular y escalable
- ✅ Soporte para múltiples entornos (desarrollo, producción, testing)

## Requisitos Previos

- Python 3.8+
- pip (gestor de paquetes de Python)

*SQLite está incluido en Python, no necesita instalación adicional*

## Instalación

### 1. Clonar o descargar el proyecto

```bash
cd FoodGestor
```

### 2. Crear entorno virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

1. Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. El archivo ya está pre-configurado para SQLite. Si quieres usar MySQL en producción, edita:
   ```
   FLASK_ENV=development
   DATABASE_URL=sqlite:///foodgestor.db  # Para desarrollo
   ```

### 5. Ejecutar la aplicación

```bash
python main.py
```

La API estará disponible en `http://localhost:5000`

## Estructura del Proyecto

```
FoodGestor/
├── app/
│   ├── __init__.py          # Factory de Flask y configuración
│   ├── config.py            # Configuraciones por entorno
│   ├── models.py            # Modelos de la BD (Product, Order)
│   └── routes.py            # Endpoints de la API
├── main.py                  # Punto de entrada de la aplicación
├── requirements.txt         # Dependencias del proyecto
├── .env.example             # Variables de entorno (plantilla)
├── .env                     # Variables de entorno (local)
└── README.md               # Este archivo
```

## Endpoints de la API

### Health Check
- **GET** `/api/health` - Verificar estado de la API

### Alimentos
- **GET** `/api/alimentos` - Obtener todos los alimentos
- **GET** `/api/alimentos/<id>` - Obtener un alimento específico
- **GET** `/api/alimentos/buscar/<codigo>` - Buscar por código
- **POST** `/api/alimentos` - Crear nuevo alimento
- **PUT** `/api/alimentos/<id>` - Actualizar alimento
- **DELETE** `/api/alimentos/<id>` - Eliminar alimento

### Ingredientes
- **GET** `/api/ingredientes` - Obtener todos los ingredientes
- **GET** `/api/ingredientes/<id>` - Obtener un ingrediente específico
- **GET** `/api/ingredientes/alergenos` - Obtener alérgenos
- **GET** `/api/ingredientes/intolerancias` - Obtener intolerancias
- **GET** `/api/ingredientes/aditivos` - Obtener aditivos
- **POST** `/api/ingredientes` - Crear nuevo ingrediente
- **PUT** `/api/ingredientes/<id>` - Actualizar ingrediente
- **DELETE** `/api/ingredientes/<id>` - Eliminar ingrediente

### Relaciones
- **POST** `/api/alimentos/<id>/ingredientes/<id>` - Asociar ingrediente a alimento
- **DELETE** `/api/alimentos/<id>/ingredientes/<id>` - Desasociar ingrediente

### Códigos
- **POST** `/api/codigos/<alimento_id>` - Agregar código a un alimento
- **DELETE** `/api/codigos/<codigo_id>` - Eliminar un código

## Ejemplos de Uso

### Crear un Alimento

```bash
curl -X POST http://localhost:5000/api/alimentos \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Pechuga de Pollo",
    "descripcion": "Pechuga fresca",
    "calorias": 165,
    "proteinas": 31,
    "grasas": 3.6,
    "grasas_saturadas": 1,
    "hidratos_carbono": 0,
    "azucares": 0,
    "fibra": 0,
    "sal": 0.07,
    "sodio": 28,
    "potasio": 280,
    "calcio": 11,
    "hierro": 0.8,
    "categoria": "Proteína",
    "origen": "España"
  }'
```

### Obtener Todos los Alimentos

```bash
curl http://localhost:5000/api/alimentos
```

### Buscar por Código

```bash
curl http://localhost:5000/api/alimentos/buscar/8410000123456
```

### Obtener Alérgenos

```bash
curl http://localhost:5000/api/ingredientes/alergenos
```

### Crear un Ingrediente con Alérgeno

```bash
curl -X POST http://localhost:5000/api/ingredientes \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Cacahuete",
    "descripcion": "Legumbre con alto contenido de proteína",
    "es_alergeno": true,
    "alergenos_asociados": "Cacahuete, frutos secos",
    "es_vegetariano": true,
    "es_vegano": true
  }'
```

### Asociar Ingrediente a Alimento

```bash
curl -X POST http://localhost:5000/api/alimentos/1/ingredientes/3
```

### Agregar Código a un Alimento

```bash
curl -X POST http://localhost:5000/api/codigos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_codigo": "EAN",
    "valor": "8410000654321",
    "descripcion": "Código EAN pechuga"
  }'
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `FLASK_ENV` | Entorno de ejecución | `development`, `production`, `testing` |
| `DATABASE_URL` | URL de conexión MySQL | `mysql+mysqlconnector://user:pass@localhost:3306/foodgestor` |

## Próximas Mejoras

- [ ] Autenticación y autorización (JWT)
- [ ] Validación más robusta de datos
- [ ] Documentación Swagger/OpenAPI
- [ ] Logs estructurados
- [ ] Tests unitarios
- [ ] Paginación en endpoints
- [ ] Filtros avanzados
- [ ] Docker compose para desarrollo

## Contribuir

Las contribuciones son bienvenidas. Por favor:
1. Fork del repositorio
2. Crear una rama para tu feature
3. Commit con mensajes descriptivos
4. Push a la rama
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo licencia MIT.

## Soporte

Para reportar problemas o sugerencias, abre un issue en el repositorio.
