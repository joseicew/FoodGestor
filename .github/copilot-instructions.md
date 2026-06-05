# FoodGestor - Instrucciones del Proyecto

Este archivo contiene instrucciones específicas para trabajar con el proyecto FoodGestor.

## Configuración Inicial

1. **Crear base de datos MySQL:**
   ```sql
   CREATE DATABASE foodgestor;
   USE foodgestor;
   ```

2. **Instalar dependencias:**
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/Mac:
   source venv/bin/activate
   
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno (.env):**
   - FLASK_ENV: development, production o testing
   - DATABASE_URL: URL de conexión a MySQL

## Ejecución

```bash
python main.py
```

La API está disponible en: http://localhost:5000

## Testing

Para probar los endpoints, puedes usar:
- **cURL:** Consultar los ejemplos en README.md
- **Postman:** Importar las rutas desde `/api/`
- **Thunder Client:** Extensión de VS Code

## Estructura

- `app/__init__.py` - Factory de Flask
- `app/config.py` - Configuraciones por entorno
- `app/models.py` - Modelos de BD
- `app/routes.py` - Endpoints de la API
- `main.py` - Punto de entrada

## Próximos Pasos

1. Probar los endpoints REST
2. Implementar autenticación (JWT)
3. Agregar validación robusta
4. Crear tests unitarios
5. Configurar Swagger/OpenAPI

## Recursos Útiles

- [Flask Documentation](https://flask.palletsprojects.com/)
- [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/)
- [MySQL Connector Python](https://dev.mysql.com/doc/connector-python/en/)
