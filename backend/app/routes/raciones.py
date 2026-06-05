from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.racion import Racion, racion_alimentos
from app.models.alimento import Alimento
from sqlalchemy import select

raciones_bp = Blueprint('raciones', __name__, url_prefix='/api/raciones')


@raciones_bp.route('', methods=['GET'])
@jwt_required()
def obtener_raciones():
    """Obtiene todas las raciones del usuario actual"""
    try:
        usuario_id = int(get_jwt_identity())
        raciones = Racion.query.filter_by(usuario_id=usuario_id).all()
        return jsonify([r.to_dict() for r in raciones]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['GET'])
@jwt_required()
def obtener_racion(racion_id):
    """Obtiene una ración específica del usuario actual"""
    try:
        usuario_id = int(get_jwt_identity())
        racion = Racion.query.filter_by(id=racion_id, usuario_id=usuario_id).first()
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404
        return jsonify(racion.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('', methods=['POST'])
@jwt_required()
def crear_racion():
    """Crea una nueva ración para el usuario actual"""
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}
        nombre = data.get('nombre', '').strip()

        if not nombre:
            return jsonify({'error': 'El nombre es obligatorio'}), 400

        # Verificar que no exista una ración con ese nombre para este usuario
        existe = Racion.query.filter_by(nombre=nombre, usuario_id=usuario_id).first()
        if existe:
            return jsonify({'error': f'Ya existe una ración llamada "{nombre}"'}), 409

        racion = Racion(
            usuario_id=usuario_id,
            nombre=nombre,
            descripcion=data.get('descripcion', '')
        )
        db.session.add(racion)
        db.session.commit()

        return jsonify({
            'mensaje': 'Ración creado exitosamente',
            'racion': racion.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['PUT'])
def actualizar_racion(racion_id):
    """Actualiza una ración existente"""
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404

        data = request.get_json() or {}

        if 'nombre' in data:
            nombre = data['nombre'].strip()
            if nombre:
                racion.nombre = nombre

        if 'descripcion' in data:
            racion.descripcion = data['descripcion']

        db.session.commit()
        return jsonify({
            'mensaje': 'Ración actualizado',
            'racion': racion.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['DELETE'])
def eliminar_racion(racion_id):
    """Elimina una ración"""
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404

        db.session.delete(racion)
        db.session.commit()
        return jsonify({'mensaje': 'Ración eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos', methods=['POST'])
def agregar_alimento_racion(racion_id):
    """Agrega un alimento a una ración"""
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404

        data = request.get_json() or {}
        alimento_id = data.get('alimento_id')
        cantidad = data.get('cantidad', 100)  # default 100g

        if not alimento_id:
            return jsonify({'error': 'alimento_id es requerido'}), 400

        alimento = Alimento.query.get(alimento_id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        # Verificar si ya existe
        existe = db.session.execute(
            select(racion_alimentos).where(
                (racion_alimentos.c.racion_id == racion_id) &
                (racion_alimentos.c.alimento_id == alimento_id)
            )
        ).first()

        if existe:
            return jsonify({'error': 'Este alimento ya está en la ración'}), 409

        # Insertar directamente en la tabla junction con la cantidad
        stmt = racion_alimentos.insert().values(
            racion_id=racion_id,
            alimento_id=alimento_id,
            cantidad=cantidad
        )
        db.session.execute(stmt)
        db.session.commit()

        # Recargar la ración para obtener la versión actualizada
        db.session.refresh(racion)
        return jsonify({
            'mensaje': 'Alimento agregado a la ración',
            'racion': racion.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos/<int:alimento_id>', methods=['DELETE'])
def remover_alimento_racion(racion_id, alimento_id):
    """Remueve un alimento de una ración"""
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404

        alimento = Alimento.query.get(alimento_id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        if alimento in racion.alimentos:
            racion.alimentos.remove(alimento)
            db.session.commit()
            return jsonify({
                'mensaje': 'Alimento removido de la ración',
                'racion': racion.to_dict()
            }), 200
        else:
            return jsonify({'error': 'El alimento no está en esta ración'}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos/<int:alimento_id>', methods=['PUT'])
def actualizar_cantidad_alimento(racion_id, alimento_id):
    """Actualiza la cantidad de un alimento en una ración"""
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrado'}), 404

        alimento = Alimento.query.get(alimento_id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        data = request.get_json() or {}
        cantidad = data.get('cantidad', 100)

        if cantidad <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

        # Actualizar cantidad
        db.session.execute(
            racion_alimentos.update().where(
                (racion_alimentos.c.racion_id == racion_id) &
                (racion_alimentos.c.alimento_id == alimento_id)
            ).values(cantidad=cantidad)
        )

        db.session.commit()
        return jsonify({
            'mensaje': 'Cantidad actualizada',
            'racion': racion.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
