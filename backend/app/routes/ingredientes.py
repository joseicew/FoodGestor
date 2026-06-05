from flask import Blueprint, request, jsonify
from app import db
from app.models.ingrediente import Ingrediente

ingredientes_bp = Blueprint('ingredientes', __name__, url_prefix='/api/ingredientes')


@ingredientes_bp.route('/', methods=['GET'])
def obtener_ingredientes():
    """Obtener lista de ingredientes"""
    try:
        es_aditivo = request.args.get('es_aditivo', None)

        query = Ingrediente.query

        if es_aditivo is not None:
            es_aditivo = es_aditivo.lower() == 'true'
            query = query.filter_by(es_aditivo=es_aditivo)

        ingredientes = query.order_by(Ingrediente.nombre).all()

        return jsonify({
            'ingredientes': [ing.to_dict() for ing in ingredientes],
            'total': len(ingredientes)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['GET'])
def obtener_ingrediente(ingrediente_id):
    """Obtener un ingrediente específico"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        return jsonify(ingrediente.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/', methods=['POST'])
def crear_ingrediente():
    """Crear un nuevo ingrediente"""
    try:
        data = request.get_json()

        if not data or 'nombre' not in data:
            return jsonify({'error': 'nombre es requerido'}), 400

        # Verificar que no exista
        if Ingrediente.query.filter_by(nombre=data['nombre']).first():
            return jsonify({'error': 'Este ingrediente ya existe'}), 409

        ingrediente = Ingrediente(
            nombre=data['nombre'],
            categoria=data.get('categoria', ''),
            es_aditivo=data.get('es_aditivo', False),
            notas=data.get('notas', ''),
            verificado=data.get('verificado', False)
        )

        # Asignar categorías de alergenos si vienen en la request
        if 'alergenos_categorias' in data and isinstance(data['alergenos_categorias'], list):
            ingrediente.set_alergenos_categorias(data['alergenos_categorias'])

        db.session.add(ingrediente)
        db.session.commit()

        return jsonify({
            'mensaje': 'Ingrediente creado exitosamente',
            'ingrediente': ingrediente.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['PUT'])
def actualizar_ingrediente(ingrediente_id):
    """Actualizar un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        data = request.get_json()

        if 'nombre' in data:
            ingrediente.nombre = data['nombre']
        if 'categoria' in data:
            ingrediente.categoria = data['categoria']
        if 'es_aditivo' in data:
            ingrediente.es_aditivo = data['es_aditivo']
        if 'notas' in data:
            ingrediente.notas = data['notas']
        if 'verificado' in data:
            ingrediente.verificado = data['verificado']

        # Actualizar categorías de alergenos si vienen en la request
        if 'alergenos_categorias' in data and isinstance(data['alergenos_categorias'], list):
            ingrediente.set_alergenos_categorias(data['alergenos_categorias'])

        db.session.commit()

        return jsonify({
            'mensaje': 'Ingrediente actualizado',
            'ingrediente': ingrediente.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['DELETE'])
def eliminar_ingrediente(ingrediente_id):
    """Eliminar un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        db.session.delete(ingrediente)
        db.session.commit()

        return jsonify({'mensaje': 'Ingrediente eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/alergenos-categorias/disponibles', methods=['GET'])
def obtener_alergenos_disponibles():
    """Obtener las categorías de alergenos/intolerancias disponibles"""
    try:
        from app.models.ingrediente import ALERGENO_CATEGORIAS
        return jsonify({
            'categorias': ALERGENO_CATEGORIAS
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/alimentos-categorias/disponibles', methods=['GET'])
def obtener_alimentos_categorias():
    """Obtener las categorías de alimentos disponibles"""
    try:
        from app.models.ingrediente import ALIMENTOS_CATEGORIAS
        return jsonify({
            'categorias': ALIMENTOS_CATEGORIAS
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>/alergenos-categorias', methods=['GET'])
def obtener_alergenos_ingrediente(ingrediente_id):
    """Obtener categorías de alergenos de un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        return jsonify({
            'ingrediente_id': ingrediente_id,
            'nombre': ingrediente.nombre,
            'alergenos_categorias': ingrediente.get_alergenos_categorias(),
            'verificado': ingrediente.verificado
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
