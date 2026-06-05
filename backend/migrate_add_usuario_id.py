#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para agregar la columna usuario_id a las tablas racion y comida_diaria
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 1. Agregar usuario_id a racion si no existe
        cursor.execute("PRAGMA table_info(racion)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'usuario_id' not in columns:
            print("[MIGRATE] Agregando usuario_id a tabla 'racion'...")
            cursor.execute("""
                ALTER TABLE racion
                ADD COLUMN usuario_id INTEGER
                REFERENCES usuario(id)
            """)
            print("[OK] Columna usuario_id agregada a 'racion'")
        else:
            print("[INFO] Columna usuario_id ya existe en 'racion'")

        # 2. Agregar usuario_id a comida_diaria si no existe
        cursor.execute("PRAGMA table_info(comida_diaria)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'usuario_id' not in columns:
            print("[MIGRATE] Agregando usuario_id a tabla 'comida_diaria'...")
            cursor.execute("""
                ALTER TABLE comida_diaria
                ADD COLUMN usuario_id INTEGER
                REFERENCES usuario(id)
            """)
            print("[OK] Columna usuario_id agregada a 'comida_diaria'")
        else:
            print("[INFO] Columna usuario_id ya existe en 'comida_diaria'")

        # 3. Obtener el usuario_id de joseicew@gmail.com
        cursor.execute("SELECT id FROM usuario WHERE email = ?", ('joseicew@gmail.com',))
        result = cursor.fetchone()

        if not result:
            print("[ERROR] Usuario joseicew@gmail.com no encontrado")
            conn.close()
            return 1

        usuario_id = result[0]
        print("[OK] Usuario encontrado: joseicew@gmail.com (ID: {})".format(usuario_id))

        # 4. Asignar usuario_id a raciones
        cursor.execute("""
            UPDATE racion
            SET usuario_id = ?
            WHERE usuario_id IS NULL
        """, (usuario_id,))
        raciones_asignadas = cursor.rowcount
        print("[OK] Raciones asignadas: {}".format(raciones_asignadas))

        # 5. Asignar usuario_id a comidas diarias
        cursor.execute("""
            UPDATE comida_diaria
            SET usuario_id = ?
            WHERE usuario_id IS NULL
        """, (usuario_id,))
        comidas_asignadas = cursor.rowcount
        print("[OK] Comidas diarias asignadas: {}".format(comidas_asignadas))

        # Confirmar cambios
        conn.commit()

        print("\n[SUCCESS] Migracion completada exitosamente")

        conn.close()
        return 0

    except Exception as e:
        print("[ERROR] {}".format(e))
        return 1

if __name__ == '__main__':
    sys.exit(main())
