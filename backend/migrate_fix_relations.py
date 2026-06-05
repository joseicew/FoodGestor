#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para arreglar las relaciones de Foreign Key en las tablas
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("[MIGRATE] Arreglando relaciones de Foreign Key...")

        # 1. Recrear tabla racion con usuario_id como FK
        print("[STEP 1] Recreando tabla 'racion'...")

        # Guardar datos de racion
        cursor.execute("SELECT id, usuario_id, nombre, descripcion, created_at, updated_at FROM racion")
        raciones_data = cursor.fetchall()

        # Guardar datos de racion_alimentos
        cursor.execute("SELECT racion_id, alimento_id, cantidad FROM racion_alimentos")
        racion_alimentos_data = cursor.fetchall()

        # Eliminar tabla racion_alimentos (depende de racion)
        cursor.execute("DROP TABLE IF EXISTS racion_alimentos")

        # Eliminar tabla racion
        cursor.execute("DROP TABLE IF EXISTS racion")

        # Recrear tabla racion con FK correcto
        cursor.execute("""
            CREATE TABLE racion (
                id INTEGER PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY (usuario_id) REFERENCES usuario(id)
            )
        """)

        # Recrear tabla racion_alimentos
        cursor.execute("""
            CREATE TABLE racion_alimentos (
                racion_id INTEGER NOT NULL,
                alimento_id INTEGER NOT NULL,
                cantidad FLOAT DEFAULT 100,
                PRIMARY KEY (racion_id, alimento_id),
                FOREIGN KEY (racion_id) REFERENCES racion(id),
                FOREIGN KEY (alimento_id) REFERENCES alimento(id)
            )
        """)

        # Restaurar datos
        for racion in raciones_data:
            cursor.execute("""
                INSERT INTO racion (id, usuario_id, nombre, descripcion, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, racion)

        for ra in racion_alimentos_data:
            cursor.execute("""
                INSERT INTO racion_alimentos (racion_id, alimento_id, cantidad)
                VALUES (?, ?, ?)
            """, ra)

        print("[OK] Tabla 'racion' recreada con FK correcto")

        # 2. Recrear tabla comida_diaria con usuario_id como FK
        print("[STEP 2] Recreando tabla 'comida_diaria'...")

        # Guardar datos de comida_diaria
        cursor.execute("SELECT id, usuario_id, fecha, tipo_comida, created_at, updated_at FROM comida_diaria")
        comida_diaria_data = cursor.fetchall()

        # Guardar datos de comida_raciones (si existen)
        try:
            cursor.execute("SELECT comida_diaria_id, racion_id, cantidad FROM comida_raciones")
            comida_raciones_data = cursor.fetchall()
        except:
            comida_raciones_data = []

        # Guardar datos de comida_alimentos (si existen)
        try:
            cursor.execute("SELECT comida_diaria_id, alimento_id, cantidad FROM comida_alimentos")
            comida_alimentos_data = cursor.fetchall()
        except:
            comida_alimentos_data = []

        # Eliminar tablas relacionadas
        cursor.execute("DROP TABLE IF EXISTS comida_raciones")
        cursor.execute("DROP TABLE IF EXISTS comida_alimentos")
        cursor.execute("DROP TABLE IF EXISTS comida_diaria")

        # Recrear tabla comida_diaria
        cursor.execute("""
            CREATE TABLE comida_diaria (
                id INTEGER PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                tipo_comida VARCHAR(20) NOT NULL,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY (usuario_id) REFERENCES usuario(id)
            )
        """)

        # Recrear tablas junction
        cursor.execute("""
            CREATE TABLE comida_raciones (
                comida_diaria_id INTEGER NOT NULL,
                racion_id INTEGER NOT NULL,
                cantidad FLOAT DEFAULT 1,
                created_at DATETIME,
                PRIMARY KEY (comida_diaria_id, racion_id),
                FOREIGN KEY (comida_diaria_id) REFERENCES comida_diaria(id),
                FOREIGN KEY (racion_id) REFERENCES racion(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE comida_alimentos (
                comida_diaria_id INTEGER NOT NULL,
                alimento_id INTEGER NOT NULL,
                cantidad FLOAT DEFAULT 100,
                created_at DATETIME,
                PRIMARY KEY (comida_diaria_id, alimento_id),
                FOREIGN KEY (comida_diaria_id) REFERENCES comida_diaria(id),
                FOREIGN KEY (alimento_id) REFERENCES alimento(id)
            )
        """)

        # Restaurar datos
        for comida in comida_diaria_data:
            cursor.execute("""
                INSERT INTO comida_diaria (id, usuario_id, fecha, tipo_comida, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, comida)

        for cr in comida_raciones_data:
            cursor.execute("""
                INSERT INTO comida_raciones (comida_diaria_id, racion_id, cantidad)
                VALUES (?, ?, ?)
            """, cr)

        for ca in comida_alimentos_data:
            cursor.execute("""
                INSERT INTO comida_alimentos (comida_diaria_id, alimento_id, cantidad)
                VALUES (?, ?, ?)
            """, ca)

        print("[OK] Tabla 'comida_diaria' recreada con FK correcto")

        # Confirmar cambios
        conn.commit()

        print("\n[SUCCESS] Relaciones de Foreign Key arregladas correctamente")

        conn.close()
        return 0

    except Exception as e:
        print("[ERROR] {}".format(e))
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
