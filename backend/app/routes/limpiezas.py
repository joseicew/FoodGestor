import threading
from collections import defaultdict
from flask import Blueprint, jsonify, current_app
from sqlalchemy import exists
from app import db
from app.models.ingrediente import Ingrediente
from app.models.alimento import Alimento, alimento_ingrediente
from app.routes.alimentos import _agrupar_alimentos_duplicados
from app.routes.admin import requiere_rol
from app.services.job_queue import crear_job, obtener_job, actualizar_job, JobStatus
from app.services.limpieza_agente import TIPOS_LIMPIEZA, ejecutar_limpieza

limpiezas_bp = Blueprint('limpiezas', __name__, url_prefix='/api/admin/limpiezas')


def _contar_huerfanos():
    # Una sola consulta NOT EXISTS en vez de cargar todos los ingredientes y
    # lazy-loadear `.alimentos` uno por uno (eso hacía N+1 queries y agotaba
    # el pool de conexiones de Neon, provocando 500 en toda la pestaña).
    tiene_alimento = exists().where(alimento_ingrediente.c.ingrediente_id == Ingrediente.id)
    return Ingrediente.query.filter(~tiene_alimento).count()


def _contar_duplicados():
    grupos = defaultdict(int)
    for (nombre,) in db.session.query(Ingrediente.nombre).all():
        grupos[nombre.lower().strip()] += 1
    return sum(cantidad - 1 for cantidad in grupos.values() if cantidad > 1)


def _contar_sin_ingredientes():
    tiene_ingrediente = exists().where(alimento_ingrediente.c.alimento_id == Alimento.id)
    return Alimento.query.filter(~tiene_ingrediente).count()


def _contar_alimentos_duplicados():
    grupos = _agrupar_alimentos_duplicados()
    return sum(len(g['alimentos']) - 1 for g in grupos)


@limpiezas_bp.route('/tipos', methods=['GET'])
@requiere_rol('superadmin', 'admin')
def listar_tipos():
    """Lista los tipos de limpieza disponibles con cuántos ingredientes afectaría cada uno."""
    try:
        tipos = []
        for clave, config in TIPOS_LIMPIEZA.items():
            tipos.append({
                'tipo': clave,
                'nombre': config['nombre'],
                'descripcion': config['descripcion'],
                'pendientes': config['query']().count(),
                'ia': True,
            })

        # Las dos limpiezas deterministas ya existentes (sin IA) se muestran primero
        tipos.insert(0, {
            'tipo': 'huerfanos',
            'nombre': 'Ingredientes huérfanos',
            'descripcion': 'Elimina ingredientes que ya no están vinculados a ningún alimento.',
            'pendientes': _contar_huerfanos(),
            'ia': False,
        })
        tipos.insert(1, {
            'tipo': 'duplicados',
            'nombre': 'Ingredientes duplicados',
            'descripcion': 'Fusiona ingredientes con el mismo nombre (case-insensitive) en uno solo.',
            'pendientes': _contar_duplicados(),
            'ia': False,
        })
        tipos.insert(2, {
            'tipo': 'sin_ingredientes',
            'nombre': 'Alimentos sin ingredientes',
            'descripcion': 'Alimentos que no tienen ningún ingrediente asociado. Casi siempre son errores al crearlos; revísalos y añade sus ingredientes.',
            'pendientes': _contar_sin_ingredientes(),
            'ia': False,
        })
        tipos.insert(3, {
            'tipo': 'alimentos_duplicados',
            'nombre': 'Posibles alimentos duplicados',
            'descripcion': 'Alimentos con el mismo nombre y marca -probablemente el mismo producto en otro formato: paquete, cartón, botella, lata...-. Revísalos a mano.',
            'pendientes': _contar_alimentos_duplicados(),
            'ia': False,
        })

        return jsonify({'tipos': tipos}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _procesar_en_background(app, job_id, tipo):
    with app.app_context():
        try:
            actualizar_job(job_id, JobStatus.PROCESANDO)
            resultado = ejecutar_limpieza(tipo)
            actualizar_job(job_id, JobStatus.LISTO, resultado=resultado)
        except Exception as e:
            actualizar_job(job_id, JobStatus.ERROR, error=str(e))
        finally:
            db.session.remove()


@limpiezas_bp.route('/<tipo>/start', methods=['POST'])
@requiere_rol('superadmin', 'admin')
def iniciar_limpieza(tipo):
    """Lanza el agente de limpieza `tipo` en background y devuelve un job_id para sondear el progreso."""
    if tipo not in TIPOS_LIMPIEZA:
        return jsonify({'error': f'Tipo de limpieza desconocido: {tipo}'}), 400

    job_id = crear_job(f'limpieza_{tipo}', {'tipo': tipo})
    app = current_app._get_current_object()
    thread = threading.Thread(target=_procesar_en_background, args=(app, job_id, tipo), daemon=True)
    thread.start()

    return jsonify({'job_id': job_id, 'estado': 'pendiente'}), 202


@limpiezas_bp.route('/job/<job_id>', methods=['GET'])
@requiere_rol('superadmin', 'admin')
def estado_job(job_id):
    job = obtener_job(job_id)
    if not job:
        return jsonify({'error': 'Job no encontrado'}), 404
    return jsonify(job), 200
