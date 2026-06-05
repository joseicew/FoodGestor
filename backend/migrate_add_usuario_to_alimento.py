#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para agregar usuario_id a la tabla alimento
"""
import sqlite3
import sys
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance/foodgestor.db')

def main():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("[MIGRATE] Agregando usuario_id a tabla 'alimento'...")

        # Guardar todos los datos de alimento
        cursor.execute("""
            SELECT id, nombre, marca, descripcion, calorias, proteinas, grasas,
                   grasas_saturadas, hidratos_carbono, azucares, fibra, sal, sodio,
                   potasio, calcio, hierro, categoria, codigo_barras, foto_ingredientes,
                   foto_macros, favorito, created_at, updated_at
            FROM alimento
        """)
        alimentos_data = cursor.fetchall()

        # Obtener el usuario_id de joseicew@gmail.com
        cursor.execute("SELECT id FROM usuario WHERE email = ?", ('joseicew@gmail.com',))
        result = cursor.fetchone()
        if not result:
            print("[ERROR] Usuario joseicew@gmail.com no encontrado")
            return 1
        usuario_id = result[0]

        # Eliminar tabla alimento
        cursor.execute("DROP TABLE IF EXISTS alimento")

        # Recrear tabla alimento con usuario_id
        cursor.execute("""
            CREATE TABLE alimento (
                id INTEGER PRIMARY KEY,
                usuario_id INTEGER NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                marca VARCHAR(255),
                descripcion TEXT,
                calorias FLOAT,
                proteinas FLOAT,
                grasas FLOAT,
                grasas_saturadas FLOAT,
                hidratos_carbono FLOAT,
                azucares FLOAT,
                fibra FLOAT,
                sal FLOAT,
                sodio FLOAT,
                potasio FLOAT,
                calcio FLOAT,
                hierro FLOAT,
                categoria VARCHAR(100),
                codigo_barras VARCHAR(20),
                foto_ingredientes VARCHAR(255),
                foto_macros VARCHAR(255),
                favorito BOOLEAN DEFAULT 0,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY (usuario_id) REFERENCES usuario(id)
            )
        """)

        # Restaurar datos
        for alimento in alimentos_data:
            cursor.execute("""
                INSERT INTO alimento
                (id, usuario_id, nombre, marca, descripcion, calorias, proteinas, grasas,
                 grasas_saturadas, hidratos_carbono, azucares, fibra, sal, sodio, potasio,
                 calcio, hierro, categoria, codigo_barras, foto_ingredientes, foto_macros,
                 favorito, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (alimento[0], usuario_id) + alimento[1:])

        print("[OK] Tabla 'alimento' recreada con usuario_id")

        # Confirmar cambios
        conn.commit()

        print("[SUCCESS] Migracion completada exitosamente")
        print("[OK] {} alimentos asignados al usuario {}".format(len(alimentos_data), usuario_id))

        conn.close()
        return 0

    except Exception as e:
        print("[ERROR] {}".format(e))
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
