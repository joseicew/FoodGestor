import os
import sys
from pathlib import Path

# Cargar .env antes de importar app
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

# Importar create_app
from app import create_app

# Crear la app (será usada por gunicorn)
app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    app.run(debug=False, port=port, host=host)
