#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para agregar campo getd_calculada a la tabla usuario
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("[MIGRATE] Agregando campo 'getd_calculada' a tabla 'usuario'...")

        # Verificar si la columna ya existe
        cursor.execute("PRAGMA table_info(usuario)")
        columnas = [col[1] for col in cursor.fetchall()]

        # Agregar getd_calculada si no existe
        if 'getd_calculada' not in columnas:
            print("[OK] Agregando columna 'getd_calculada'...")
            cursor.execute("""
                ALTER TABLE usuario
                ADD COLUMN getd_calculada FLOAT DEFAULT 0
            """)
        else:
            print("[INFO] Columna 'getd_calculada' ya existe")

        # Confirmar cambios
        conn.commit()
        print("[SUCCESS] Migración completada exitosamente")

        # Mostrar estructura de tabla actualizada
        cursor.execute("PRAGMA table_info(usuario)")
        print("\n[INFO] Campos de tabla 'usuario':")
        for col in cursor.fetchall():
            print(f"  - {col[1]} ({col[2]})")

        conn.close()
        return 0

    except Exception as e:
        print("[ERROR] {}".format(e))
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
