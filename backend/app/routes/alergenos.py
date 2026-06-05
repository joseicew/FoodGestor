from flask import Blueprint, request, jsonify
from app import db
from app.models.alergeno import Alergeno

alergenos_bp = Blueprint('alergenos', __name__, url_prefix='/api/alergenos')


@alergenos_bp.route('/', methods=['GET'])
def obtener_alergenos():
    """Obtener lista de todos los alérgenos/intolerancias"""
    try:
        # Parámetros opcionales para filtrar
        es_aditivo = request.args.get('es_aditivo', None)
        categoria = request.args.get('categoria', None)

        query = Alergeno.query

        if es_aditivo is not None:
            es_aditivo = es_aditivo.lower() == 'true'
            query = query.filter_by(es_aditivo=es_aditivo)

        if categoria:
            query = query.filter_by(categoria=categoria)

        alergenos = query.order_by(Alergeno.nombre).all()

        return jsonify({
            'alergenos': [a.to_dict() for a in alergenos],
            'total': len(alergenos)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alergenos_bp.route('/<int:alergeno_id>', methods=['GET'])
def obtener_alergeno(alergeno_id):
    """Obtener un alérgeno específico"""
    try:
        alergeno = Alergeno.query.get(alergeno_id)
        if not alergeno:
            return jsonify({'error': 'Alérgeno no encontrado'}), 404

        return jsonify(alergeno.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alergenos_bp.route('/', methods=['POST'])
def crear_alergeno():
    """Crear un nuevo alérgeno/intolerancia"""
    try:
        data = request.get_json()

        if not data or 'nombre' not in data:
            return jsonify({'error': 'nombre es requerido'}), 400

        # Verificar que no exista
        if Alergeno.query.filter_by(nombre=data['nombre']).first():
            return jsonify({'error': 'Este alérgeno ya existe'}), 409

        alergeno = Alergeno(
            nombre=data['nombre'],
            codigo_allergen=data.get('codigo_allergen'),
            es_aditivo=data.get('es_aditivo', False),
            categoria=data.get('categoria')
        )

        db.session.add(alergeno)
        db.session.commit()

        return jsonify({
            'mensaje': 'Alérgeno creado exitosamente',
            'alergeno': alergeno.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alergenos_bp.route('/<int:alergeno_id>', methods=['PUT'])
def actualizar_alergeno(alergeno_id):
    """Actualizar un alérgeno"""
    try:
        alergeno = Alergeno.query.get(alergeno_id)
        if not alergeno:
            return jsonify({'error': 'Alérgeno no encontrado'}), 404

        data = request.get_json()

        if 'nombre' in data:
            alergeno.nombre = data['nombre']
        if 'codigo_allergen' in data:
            alergeno.codigo_allergen = data['codigo_allergen']
        if 'es_aditivo' in data:
            alergeno.es_aditivo = data['es_aditivo']
        if 'categoria' in data:
            alergeno.categoria = data['categoria']

        db.session.commit()

        return jsonify({
            'mensaje': 'Alérgeno actualizado',
            'alergeno': alergeno.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alergenos_bp.route('/<int:alergeno_id>', methods=['DELETE'])
def eliminar_alergeno(alergeno_id):
    """Eliminar un alérgeno"""
    try:
        alergeno = Alergeno.query.get(alergeno_id)
        if not alergeno:
            return jsonify({'error': 'Alérgeno no encontrado'}), 404

        db.session.delete(alergeno)
        db.session.commit()

        return jsonify({'mensaje': 'Alérgeno eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alergenos_bp.route('/seed', methods=['POST'])
def seed_alergenos():
    """Crear alérgenos predefinidos (datos iniciales)"""
    try:
        alergenos_predefinidos = [
            # Alérgenos principales (EU - Reglamento 1169/2011)
            {'nombre': 'Gluten', 'categoria': 'cereal', 'es_aditivo': False},
            {'nombre': 'Crustáceos', 'categoria': 'marisco', 'es_aditivo': False},
            {'nombre': 'Huevo', 'categoria': 'proteína animal', 'es_aditivo': False},
            {'nombre': 'Pescado', 'categoria': 'marisco', 'es_aditivo': False},
            {'nombre': 'Cacahuete', 'categoria': 'fruto seco', 'es_aditivo': False},
            {'nombre': 'Frutos secos', 'categoria': 'fruto seco', 'es_aditivo': False},
            {'nombre': 'Soja', 'categoria': 'legumbre', 'es_aditivo': False},
            {'nombre': 'Lactosa', 'categoria': 'lácteo', 'es_aditivo': False},
            {'nombre': 'Moluscos', 'categoria': 'marisco', 'es_aditivo': False},

            # Alérgenos adicionales (EU)
            {'nombre': 'Apio', 'categoria': 'vegetal', 'es_aditivo': False},
            {'nombre': 'Mostaza', 'categoria': 'condimento', 'es_aditivo': False},
            {'nombre': 'Sésamo', 'categoria': 'semilla', 'es_aditivo': False},
            {'nombre': 'Altramuces', 'categoria': 'legumbre', 'es_aditivo': False},

            # Aditivos comunes
            {'nombre': 'Sulfitos', 'categoria': 'aditivo', 'es_aditivo': True},
            {'nombre': 'E102', 'categoria': 'colorante', 'es_aditivo': True},  # Tartrazina
            {'nombre': 'E110', 'categoria': 'colorante', 'es_aditivo': True},  # Amarillo anaranjado
            {'nombre': 'E122', 'categoria': 'colorante', 'es_aditivo': True},  # Azorrubina
            {'nombre': 'E124', 'categoria': 'colorante', 'es_aditivo': True},  # Ponceau

            # Intolerancias comunes
            {'nombre': 'Histamina', 'categoria': 'intolerancia', 'es_aditivo': False},
            {'nombre': 'Tiramina', 'categoria': 'intolerancia', 'es_aditivo': False},
            {'nombre': 'Fenilalanina', 'categoria': 'intolerancia', 'es_aditivo': False},
        ]

        creados = 0
        duplicados = 0

        for item in alergenos_predefinidos:
            if not Alergeno.query.filter_by(nombre=item['nombre']).first():
                alergeno = Alergeno(**item)
                db.session.add(alergeno)
                creados += 1
            else:
                duplicados += 1

        db.session.commit()

        return jsonify({
            'mensaje': 'Datos iniciales cargados',
            'creados': creados,
            'duplicados': duplicados
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
