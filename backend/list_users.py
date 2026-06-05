#!/usr/bin/env python3
"""
Script para listar todos los usuarios de la base de datos
"""
import sys
import os
from sqlalchemy import text

# Agregar la carpeta app al path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db

def listar_usuarios():
    """Lista todos los usuarios"""
    app = create_app()

    with app.app_context():
        result = db.session.execute(text("SELECT id, email, nombre_completo FROM usuario")).fetchall()

        if not result:
            print("No hay usuarios en la base de datos")
            return

        print(f"\nTotal de usuarios: {len(result)}\n")
        for user_id, email, nombre in result:
            print(f"ID: {user_id}")
            print(f"  Email: {email}")
            print(f"  Nombre: {nombre or '(sin nombre)'}")
            print()

if __name__ == '__main__':
    listar_usuarios()
