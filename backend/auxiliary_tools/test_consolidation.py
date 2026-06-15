#!/usr/bin/env python
import sys
import traceback
sys.path.insert(0, '/mnt/c/Users/Joza/Documents/Proyectos/FoodGestor/backend')

try:
    from app import create_app
    from app.routes.ingredientes import consolidar_ingredientes_duplicados

    app = create_app()

    with app.app_context():
        print("Ejecutando consolidación de ingredientes...")
        result = consolidar_ingredientes_duplicados()
        print(f"Resultado: {result}")

except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()
