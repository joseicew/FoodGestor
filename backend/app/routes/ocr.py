from flask import Blueprint, request, jsonify
from app.services.ocr_service import procesar_ingredientes, procesar_macros, procesar_codigo_barras, procesar_datos_completos

ocr_bp = Blueprint('ocr', __name__, url_prefix='/api/ocr')

ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}


def _validar_imagen():
    if 'imagen' not in request.files:
        return None, jsonify({'error': 'No se proporcionó imagen (campo: "imagen")'}), 400
    file = request.files['imagen']
    if not file or not file.filename:
        return None, jsonify({'error': 'Archivo inválido'}), 400
    content_type = file.content_type or 'image/jpeg'
    if content_type not in ALLOWED_TYPES:
        return None, jsonify({'error': f'Tipo no soportado: {content_type}'}), 400
    return file, None, None


@ocr_bp.route('/ingredientes', methods=['POST'])
def ocr_ingredientes():
    file, err_response, err_code = _validar_imagen()
    if err_response:
        return err_response, err_code
    try:
        data = file.read()
        ingredientes = procesar_ingredientes(data, file.content_type)
        return jsonify({'ingredientes': ingredientes}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/codigo_barras', methods=['POST'])
def ocr_codigo_barras():
    file, err_response, err_code = _validar_imagen()
    if err_response:
        return err_response, err_code
    try:
        data = file.read()
        codigo = procesar_codigo_barras(data, file.content_type)
        if not codigo:
            return jsonify({'error': 'No se detectó ningún código de barras'}), 422
        return jsonify({'codigo_barras': codigo}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/macros', methods=['POST'])
def ocr_macros():
    file, err_response, err_code = _validar_imagen()
    if err_response:
        return err_response, err_code
    try:
        data = file.read()
        macros = procesar_macros(data, file.content_type)
        return jsonify({'macros': macros}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ocr_bp.route('/datos-completos', methods=['POST'])
def ocr_datos_completos():
    """Extrae todos los datos (nombre, marca, macros, ingredientes, código) de una sola imagen"""
    file, err_response, err_code = _validar_imagen()
    if err_response:
        return err_response, err_code
    try:
        data = file.read()
        datos = procesar_datos_completos(data, file.content_type)
        return jsonify({'datos': datos}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
