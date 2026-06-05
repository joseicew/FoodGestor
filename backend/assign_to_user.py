#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para asignar todas las raciones y datos del calendario a un usuario específico
"""
import sqlite3
import sys
import os

# Obtener la ruta de la base de datos
db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Obtener el usuario_id de joseicew@gmail.com
        cursor.execute("SELECT id FROM usuario WHERE email = ?", ('joseicew@gmail.com',))
        result = cursor.fetchone()

        if not result:
            print("[ERROR] Usuario joseicew@gmail.com no encontrado")
            conn.close()
            return 1

        usuario_id = result[0]
        print("[OK] Usuario encontrado: joseicew@gmail.com (ID: {})".format(usuario_id))

        # 2. Obtener raciones sin usuario_id o con otro usuario_id
        cursor.execute("SELECT COUNT(*) FROM racion WHERE usuario_id IS NULL OR usuario_id != ?", (usuario_id,))
        raciones_sin_usuario = cursor.fetchone()[0]
        print("     Raciones para actualizar: {}".format(raciones_sin_usuario))

        # 3. Obtener comidas diarias sin usuario_id o con otro usuario_id
        cursor.execute("SELECT COUNT(*) FROM comida_diaria WHERE usuario_id IS NULL OR usuario_id != ?", (usuario_id,))
        comidas_sin_usuario = cursor.fetchone()[0]
        print("     Comidas diarias para actualizar: {}".format(comidas_sin_usuario))

        # 4. Actualizar raciones
        cursor.execute("""
            UPDATE racion
            SET usuario_id = ?
            WHERE usuario_id IS NULL OR usuario_id != ?
        """, (usuario_id, usuario_id))
        raciones_actualizadas = cursor.rowcount
        print("\n[OK] Raciones asignadas: {}".format(raciones_actualizadas))

        # 5. Actualizar comidas diarias
        cursor.execute("""
            UPDATE comida_diaria
            SET usuario_id = ?
            WHERE usuario_id IS NULL OR usuario_id != ?
        """, (usuario_id, usuario_id))
        comidas_actualizadas = cursor.rowcount
        print("[OK] Comidas diarias asignadas: {}".format(comidas_actualizadas))

        # Confirmar cambios
        conn.commit()

        print("\n[SUCCESS] Todo asignado a joseicew@gmail.com correctamente")

        conn.close()
        return 0

    except Exception as e:
        print("[ERROR] {}".format(e))
        return 1

if __name__ == '__main__':
    sys.exit(main())
