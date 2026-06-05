#!/usr/bin/env python3
"""
Script para eliminar un usuario de la base de datos usando SQL directo
"""
import sys
import os
from sqlalchemy import text

# Agregar la carpeta app al path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db

def eliminar_usuario(email):
    """Elimina un usuario por email usando SQL directo"""
    app = create_app()

    with app.app_context():
        # Usar SQL raw para obtener el usuario
        result = db.session.execute(text("SELECT id, email FROM usuario WHERE email = :email"), {"email": email}).first()

        if not result:
            print(f"No se encontro usuario con email: {email}")
            return False

        user_id, user_email = result

        print(f"Eliminando usuario: {user_email} (ID: {user_id})")

        # Preguntar confirmación
        confirmacion = input("\nEsta seguro de que deseas eliminar este usuario? (s/n): ")

        if confirmacion.lower() != 's':
            print("Cancelado")
            return False

        try:
            # Usar SQL raw para eliminar
            db.session.execute(text("DELETE FROM usuario WHERE id = :id"), {"id": user_id})
            db.session.commit()
            print(f"Usuario {email} eliminado correctamente")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error al eliminar usuario: {str(e)}")
            return False

if __name__ == '__main__':
    if len(sys.argv) > 1:
        email = sys.argv[1]
    else:
        email = input("Ingresa el email del usuario a eliminar: ")

    if not email:
        print("Email requerido")
        sys.exit(1)

    eliminar_usuario(email)
