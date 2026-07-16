from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.reporte_alimento import ReporteAlimento
from app.models.alimento import Alimento

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api/reportes')

CAMPOS_VALIDOS = ['macros', 'ingredientes', 'marca', 'otro']


@reportes_bp.route('', methods=['POST'])
@jwt_required()
def crear_reporte():
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}

        alimento_id = data.get('alimento_id')
        if not alimento_id or not Alimento.query.get(alimento_id):
            return jsonify({'error': 'Alimento no encontrado'}), 404

        campos = data.get('campos') or []
        campos = [c for c in campos if c in CAMPOS_VALIDOS]
        if not campos:
            return jsonify({'error': 'Selecciona al menos un campo (macros, ingredientes, marca u otro)'}), 400

        reporte = ReporteAlimento(
            alimento_id=alimento_id,
            usuario_id=usuario_id,
            comentario=(data.get('comentario') or '').strip()
        )
        reporte.set_campos(campos)
        db.session.add(reporte)
        db.session.commit()

        return jsonify({
            'mensaje': 'Gracias, hemos recibido tu reporte',
            'reporte': reporte.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
