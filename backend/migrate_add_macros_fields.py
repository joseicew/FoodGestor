#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para agregar campos de carbohidratos y valores calculados a la tabla usuario
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("[MIGRATE] Agregando campos de macronutrientes a tabla 'usuario'...")

        # Verificar si las columnas ya existen
        cursor.execute("PRAGMA table_info(usuario)")
        columnas = [col[1] for col in cursor.fetchall()]

        # Agregar limites_carbohidratos si no existe
        if 'limites_carbohidratos' not in columnas:
            print("[OK] Agregando columna 'limites_carbohidratos'...")
            cursor.execute("""
                ALTER TABLE usuario
                ADD COLUMN limites_carbohidratos FLOAT DEFAULT 250
            """)
        else:
            print("[INFO] Columna 'limites_carbohidratos' ya existe")

        # Agregar tmb_calculada si no existe
        if 'tmb_calculada' not in columnas:
            print("[OK] Agregando columna 'tmb_calculada'...")
            cursor.execute("""
                ALTER TABLE usuario
                ADD COLUMN tmb_calculada FLOAT DEFAULT 0
            """)
        else:
            print("[INFO] Columna 'tmb_calculada' ya existe")

        # Agregar tdee_calculada si no existe
        if 'tdee_calculada' not in columnas:
            print("[OK] Agregando columna 'tdee_calculada'...")
            cursor.execute("""
                ALTER TABLE usuario
                ADD COLUMN tdee_calculada FLOAT DEFAULT 0
            """)
        else:
            print("[INFO] Columna 'tdee_calculada' ya existe")

        # Confirmar cambios
        conn.commit()
        print("[SUCCESS] Migración completada exitosamente")

        # Mostrar estructura de tabla actualizada
        cursor.execute("PRAGMA table_info(usuario)")
        print("\n[INFO] Estructura de tabla 'usuario' después de migración:")
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
