#!/usr/bin/env python3
"""
Migración: Remover usuario_id de alimentos (son catálogo global).
Los alimentos son compartidos entre todos los usuarios.
"""

import os
import sys

basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db

app = create_app()

def migrate():
    with app.app_context():
        print("[*] Ejecutando migración: remover usuario_id de alimentos...")

        try:
            # Remover la foreign key y la columna
            db.session.execute(db.text('''
                ALTER TABLE alimento
                DROP CONSTRAINT IF EXISTS alimento_usuario_id_fkey
            '''))

            db.session.execute(db.text('''
                ALTER TABLE alimento
                DROP COLUMN IF EXISTS usuario_id
            '''))

            db.session.commit()
            print("[OK] usuario_id removido de alimentos")

        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] {e}")
            return False

    return True

if __name__ == '__main__':
    if migrate():
        print("[DONE] Migración completada")
    else:
        print("[FAILED] Migración falló")
        sys.exit(1)
