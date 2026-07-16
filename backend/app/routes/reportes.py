from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.reporte_alimento import ReporteAlimento
from app.models.alimento import Alimento

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api/reportes')

CAMPOS_VALIDOS = ['macros', 'ingredientes', 'marca', 'otro']

MACROS_VALIDOS = [
    'calorias', 'proteinas', 'grasas', 'grasas_saturadas', 'hidratos_carbono',
    'azucares', 'fibra', 'sal', 'sodio', 'potasio', 'calcio', 'hierro'
]


@reportes_bp.route('', methods=['POST'])
@jwt_required()
def crear_reporte():
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}

        alimento_id = data.get('alimento_id')
        alimento = Alimento.query.get(alimento_id) if alimento_id else None
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        campos = data.get('campos') or []
        campos = [c for c in campos if c in CAMPOS_VALIDOS]
        if not campos:
            return jsonify({'error': 'Selecciona al menos un campo (macros, ingredientes, marca u otro)'}), 400

        comentario = (data.get('comentario') or '').strip()
        marca_correcta = (data.get('marca_correcta') or '').strip()

        detalle_macros = []
        if 'macros' in campos:
            detalle_macros = [m for m in (data.get('detalle_macros') or []) if m in MACROS_VALIDOS]
            if not detalle_macros:
                return jsonify({'error': 'Indica qué macro(s) están mal'}), 400

        detalle_ingredientes = []
        if 'ingredientes' in campos:
            ingredientes_alimento = set(alimento.to_dict()['ingredientes'])
            detalle_ingredientes = [i for i in (data.get('detalle_ingredientes') or []) if i in ingredientes_alimento]
            if not detalle_ingredientes:
                return jsonify({'error': 'Indica qué ingrediente(s) están mal'}), 400

        if 'marca' in campos and not marca_correcta:
            return jsonify({'error': 'Indica la marca correcta'}), 400

        if 'otro' in campos and not comentario:
            return jsonify({'error': 'Describe el problema en el comentario'}), 400

        reporte = ReporteAlimento(
            alimento_id=alimento_id,
            usuario_id=usuario_id,
            comentario=comentario,
            marca_correcta=marca_correcta or None
        )
        reporte.set_campos(campos)
        reporte.set_detalle_macros(detalle_macros)
        reporte.set_detalle_ingredientes(detalle_ingredientes)
        db.session.add(reporte)
        db.session.commit()

        return jsonify({
            'mensaje': 'Gracias, hemos recibido tu reporte',
            'reporte': reporte.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
