"""
Rutas para procesar OCR de forma asíncrona usando jobs en cola.
Devuelve un job_id inmediatamente y el frontend puede sondear el estado o usar WebSocket.
"""

from flask import Blueprint, request, jsonify
from app.services.ocr_service import procesar_ingredientes, procesar_macros, procesar_codigo_barras
from app.services.job_queue import crear_job, obtener_job, actualizar_job, JobStatus
import threading


def _detectar_tipo_imagen(image_data: bytes) -> str:
    """Detecta el tipo MIME real de la imagen analizando su contenido"""
    if image_data.startswith(b'\x89PNG'):
        return 'image/png'
    elif image_data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    elif image_data.startswith(b'GIF8'):
        return 'image/gif'
    elif image_data.startswith(b'RIFF') and image_data[8:12] == b'WEBP':
        return 'image/webp'
    else:
        # Default to JPEG for unknown formats
        return 'image/jpeg'

ocr_async_bp = Blueprint('ocr_async', __name__, url_prefix='/api/ocr')


def _procesar_en_background(job_id: str, tipo: str, image_data: bytes, content_type: str):
    """Ejecuta el procesamiento en un thread separado"""
    try:
        actualizar_job(job_id, JobStatus.PROCESANDO)

        if tipo == 'ingredientes':
            resultado = procesar_ingredientes(image_data, content_type)
        elif tipo == 'macros':
            resultado = procesar_macros(image_data, content_type)
        elif tipo == 'codigo_barras':
            resultado = procesar_codigo_barras(image_data, content_type)
        else:
            raise ValueError(f'Tipo OCR desconocido: {tipo}')

        actualizar_job(job_id, JobStatus.LISTO, resultado=resultado)
    except Exception as e:
        actualizar_job(job_id, JobStatus.ERROR, error=str(e))


@ocr_async_bp.route('/ingredientes/start', methods=['POST'])
def iniciar_ocr_ingredientes():
    """Inicia el OCR de ingredientes de forma asíncrona"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No se proporcionó imagen'}), 400

        file = request.files['image']
        if not file or not file.filename:
            return jsonify({'error': 'Archivo vacío'}), 400

        image_data = file.read()
        # Detectar el tipo real de imagen en lugar de confiar en el content_type del cliente
        content_type = _detectar_tipo_imagen(image_data)

        # Crear job
        job_id = crear_job('ocr_ingredientes', {'filename': file.filename})

        # Procesar en background
        thread = threading.Thread(
            target=_procesar_en_background,
            args=(job_id, 'ingredientes', image_data, content_type),
            daemon=True
        )
        thread.start()

        return jsonify({'job_id': job_id, 'estado': 'pendiente'}), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_async_bp.route('/macros/start', methods=['POST'])
def iniciar_ocr_macros():
    """Inicia el OCR de macros de forma asíncrona"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No se proporcionó imagen'}), 400

        file = request.files['image']
        if not file or not file.filename:
            return jsonify({'error': 'Archivo vacío'}), 400

        image_data = file.read()
        content_type = _detectar_tipo_imagen(image_data)

        # Crear job
        job_id = crear_job('ocr_macros', {'filename': file.filename})

        # Procesar en background
        thread = threading.Thread(
            target=_procesar_en_background,
            args=(job_id, 'macros', image_data, content_type),
            daemon=True
        )
        thread.start()

        return jsonify({'job_id': job_id, 'estado': 'pendiente'}), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_async_bp.route('/codigo_barras/start', methods=['POST'])
def iniciar_ocr_codigo_barras():
    """Inicia el OCR de código de barras de forma asíncrona"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No se proporcionó imagen'}), 400

        file = request.files['image']
        if not file or not file.filename:
            return jsonify({'error': 'Archivo vacío'}), 400

        image_data = file.read()
        content_type = _detectar_tipo_imagen(image_data)

        # Crear job
        job_id = crear_job('ocr_codigo_barras', {'filename': file.filename})

        # Procesar en background
        thread = threading.Thread(
            target=_procesar_en_background,
            args=(job_id, 'codigo_barras', image_data, content_type),
            daemon=True
        )
        thread.start()

        return jsonify({'job_id': job_id, 'estado': 'pendiente'}), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_async_bp.route('/job/<job_id>', methods=['GET'])
def obtener_estado_job(job_id: str):
    """Obtiene el estado actual de un job"""
    job = obtener_job(job_id)
    if not job:
        return jsonify({'error': 'Job no encontrado'}), 404

    return jsonify(job), 200
