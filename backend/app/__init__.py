from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
import os
import logging

# Cargar .env desde la carpeta backend (si existe)
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
except Exception as e:
    logging.warning(f"No .env file found or couldn't load: {e}")
db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    # Usar BD según configuración (PostgreSQL en nube o SQLite local)
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///foodgestor.db'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Connection pooling para PostgreSQL (Neon.tech hiberna tras ~5 min de inactividad)
    if database_url and 'postgresql' in database_url:
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_pre_ping': True,
            'pool_size': 3,
            'pool_recycle': 300,       # reciclar cada 5 min (igual que el auto-pause de Neon)
            'pool_timeout': 20,        # fallar en 20s (antes del timeout de Gunicorn de 30s)
            'max_overflow': 2,
            'connect_args': {'connect_timeout': 10},  # TCP: desistir en 10s si Neon no responde
        }

    # Configurar JWT
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'desarrollo-secreto-cambiar-en-produccion')
    # Token expira en 30 días (2592000 segundos) - suficiente para un uso normal sin reloguear constantemente
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

    # Inicializar extensiones
    db.init_app(app)
    CORS(app,
         origins="*",
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
         supports_credentials=False)
    jwt.init_app(app)

    # Error handler global: garantiza que los errores no capturados devuelvan JSON (no HTML)
    @app.errorhandler(Exception)
    def handle_unhandled_exception(e):
        logging.error(f'Unhandled exception: {e}', exc_info=True)
        try:
            db.session.remove()
        except Exception:
            pass
        return jsonify({'error': str(e)}), 500

    # Importar modelos para que SQLAlchemy cree las tablas
    from app.models.peso_historico import PesoHistorico  # noqa: F401

    # Registrar blueprints
    from app.routes.auth import auth_bp
    from app.routes.alimentos import alimentos_bp
    from app.routes.ingredientes import ingredientes_bp
    from app.routes.ocr import ocr_bp
    from app.routes.ocr_async import ocr_async_bp
    from app.routes.raciones import raciones_bp
    from app.routes.calendario import calendario_bp
    from app.routes.test_webhook import test_webhook_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(alimentos_bp)
    app.register_blueprint(ingredientes_bp)
    app.register_blueprint(ocr_bp)
    app.register_blueprint(ocr_async_bp)
    app.register_blueprint(raciones_bp)
    app.register_blueprint(calendario_bp)
    app.register_blueprint(test_webhook_bp)

    # Crear tablas y migrar columnas nuevas
    with app.app_context():
        try:
            # Importar modelos
            from app.models.usuario import Usuario
            from app.models.ingrediente import Ingrediente
            from app.models.racion import Racion
            from app.models.comida_diaria import ComidaDiaria

            # Crear tablas basado en los modelos definidos
            db.create_all()
            _migrar_columnas()
        except Exception as e:
            logging.error(f"Error creating tables or migrating: {e}")
            # No fallar la app si hay error en migraciones
            pass

    return app


def _migrar_columnas():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)

    # Migrar tabla usuario
    try:
        columnas = [c['name'] for c in inspector.get_columns('usuario')]
        if 'alergenos_seleccionados' not in columnas:
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE usuario ADD COLUMN alergenos_seleccionados TEXT DEFAULT '[]'"))
                conn.commit()
        if 'ingredientes_no_deseados' not in columnas:
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE usuario ADD COLUMN ingredientes_no_deseados TEXT DEFAULT '[]'"))
                conn.commit()
    except Exception as e:
        logging.error(f"Error migrating usuario table: {e}")
        pass

    # Migrar tabla alimento
    try:
        columnas = [c['name'] for c in inspector.get_columns('alimento')]
        if 'codigo_barras' not in columnas:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE alimento ADD COLUMN codigo_barras VARCHAR(100)'))
                conn.commit()
        if 'marca' not in columnas:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE alimento ADD COLUMN marca VARCHAR(255)'))
                conn.commit()
        if 'favorito' not in columnas:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE alimento ADD COLUMN favorito BOOLEAN DEFAULT 0'))
                conn.commit()
    except Exception:
        pass

    # Migrar tabla ingrediente
    try:
        columnas = [c['name'] for c in inspector.get_columns('ingrediente')]

        # Eliminar columnas innecesarias (cambio de modelo)
        campos_eliminar = ['descripcion', 'alergias', 'intolerancias', 'aditivos', 'organico', 'origen', 'fuente_datos', 'tipo']
        for col_name in campos_eliminar:
            if col_name in columnas:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text(f'ALTER TABLE ingrediente DROP COLUMN {col_name}'))
                        conn.commit()
                except Exception:
                    pass

        # Agregar columnas nuevas
        nuevas_columnas = {
            'es_aditivo': 'BOOLEAN DEFAULT 0',
            'notas': 'TEXT DEFAULT ""',
            'categoria': 'VARCHAR(100) DEFAULT ""',
            'alergenos_categorias': 'TEXT DEFAULT "[]"',
            'verificado': 'BOOLEAN DEFAULT 0',
            'updated_at': 'DATETIME'
        }
        for col_name, col_def in nuevas_columnas.items():
            if col_name not in columnas:
                with db.engine.connect() as conn:
                    conn.execute(text(f'ALTER TABLE ingrediente ADD COLUMN {col_name} {col_def}'))
                    conn.commit()
    except Exception:
        pass

    # Eliminar tabla intermedia ingrediente_alergeno
    try:
        if 'ingrediente_alergeno' in inspector.get_table_names():
            with db.engine.connect() as conn:
                conn.execute(text('DROP TABLE IF EXISTS ingrediente_alergeno'))
                conn.commit()
    except Exception:
        pass

    # Eliminar tabla alergeno (si existe)
    try:
        if 'alergeno' in inspector.get_table_names():
            with db.engine.connect() as conn:
                conn.execute(text('DROP TABLE IF EXISTS alergeno'))
                conn.commit()
    except Exception:
        pass