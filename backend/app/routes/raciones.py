from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.racion import Racion, racion_alimentos
from app.models.alimento import Alimento
from sqlalchemy import select

raciones_bp = Blueprint('raciones', __name__, url_prefix='/api/raciones')


def _safe_rollback():
    try:
        db.session.rollback()
    except Exception:
        db.session.remove()


@raciones_bp.route('', methods=['GET'])
@jwt_required()
def obtener_raciones():
    try:
        usuario_id = int(get_jwt_identity())
        raciones = Racion.query.filter_by(usuario_id=usuario_id).all()
        return jsonify([r.to_dict() for r in raciones]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['GET'])
@jwt_required()
def obtener_racion(racion_id):
    try:
        usuario_id = int(get_jwt_identity())
        racion = Racion.query.filter_by(id=racion_id, usuario_id=usuario_id).first()
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404
        return jsonify(racion.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('', methods=['POST'])
@jwt_required()
def crear_racion():
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}
        nombre = (data.get('nombre') or '').strip()

        if not nombre:
            return jsonify({'error': 'El nombre es obligatorio'}), 400

        existe = Racion.query.filter_by(nombre=nombre, usuario_id=usuario_id).first()
        if existe:
            return jsonify({'error': f'Ya existe una ración llamada "{nombre}"'}), 409

        racion = Racion(
            usuario_id=usuario_id,
            nombre=nombre,
            descripcion=data.get('descripcion', '')
        )
        categorias = data.get('categorias')
        if isinstance(categorias, list):
            racion.set_categorias(categorias)
        db.session.add(racion)
        db.session.commit()

        return jsonify({
            'mensaje': 'Ración creada exitosamente',
            'racion': racion.to_dict()
        }), 201
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


def _nombre_variante_libre(nombre_base, usuario_id):
    """Devuelve un nombre de variante que no choque con otra ración del usuario.

    "Tostada" -> "Tostada (variante)" -> "Tostada (variante 2)" -> ...
    """
    candidato = f'{nombre_base} (variante)'
    sufijo = 2
    while Racion.query.filter_by(nombre=candidato, usuario_id=usuario_id).first():
        candidato = f'{nombre_base} (variante {sufijo})'
        sufijo += 1
    return candidato


@raciones_bp.route('/<int:racion_id>/variante', methods=['POST'])
@jwt_required()
def crear_variante_racion(racion_id):
    """Crea una copia de una ración con la composición que llegue en el body.

    Pensado para el calendario: partes de una ración ya guardada y creas otra
    igual pero con las cantidades cambiadas o algún alimento de más o de menos.
    Se hace en una sola llamada para que no queden variantes a medio construir
    si algo falla por el camino.
    """
    try:
        usuario_id = int(get_jwt_identity())
        original = Racion.query.filter_by(id=racion_id, usuario_id=usuario_id).first()
        if not original:
            return jsonify({'error': 'Ración no encontrada'}), 404

        # Un cuerpo mal formado debe dar 400, no reventar en 500. Sin cuerpo
        # es válido: significa "duplícala tal cual".
        data = request.get_json(silent=True)
        if data is None:
            if request.get_data():
                return jsonify({'error': 'JSON inválido'}), 400
            data = {}

        nombre = (data.get('nombre') or '').strip()
        if nombre:
            if Racion.query.filter_by(nombre=nombre, usuario_id=usuario_id).first():
                return jsonify({'error': f'Ya existe una ración llamada "{nombre}"'}), 409
        else:
            nombre = _nombre_variante_libre(original.nombre, usuario_id)

        # Composición pedida; si no llega ninguna, se copia la de la original
        items = data.get('alimentos')
        if not isinstance(items, list) or not items:
            filas = db.session.execute(
                select(racion_alimentos.c.alimento_id, racion_alimentos.c.cantidad)
                .where(racion_alimentos.c.racion_id == racion_id)
            ).fetchall()
            items = [{'alimento_id': f[0], 'cantidad': f[1]} for f in filas]

        # Validar y deduplicar antes de tocar la BD
        composicion = {}
        for item in items:
            try:
                alimento_id = int(item.get('alimento_id'))
                cantidad = float(item.get('cantidad', 100))
            except (TypeError, ValueError):
                return jsonify({'error': 'Composición inválida'}), 400
            if cantidad <= 0:
                return jsonify({'error': 'Las cantidades deben ser mayores que 0'}), 400
            if not Alimento.query.get(alimento_id):
                return jsonify({'error': f'Alimento {alimento_id} no encontrado'}), 404
            composicion[alimento_id] = cantidad

        if not composicion:
            return jsonify({'error': 'La variante necesita al menos un alimento'}), 400

        variante = Racion(
            usuario_id=usuario_id,
            nombre=nombre,
            descripcion=(data.get('descripcion') if data.get('descripcion') is not None
                         else original.descripcion) or ''
        )
        categorias = data.get('categorias')
        variante.set_categorias(categorias if isinstance(categorias, list)
                                else original.get_categorias())
        db.session.add(variante)
        db.session.flush()  # necesitamos el id para la tabla intermedia

        db.session.execute(
            racion_alimentos.insert(),
            [{'racion_id': variante.id, 'alimento_id': aid, 'cantidad': cant}
             for aid, cant in composicion.items()]
        )
        db.session.commit()

        return jsonify({
            'mensaje': 'Variante creada',
            'racion': variante.to_dict()
        }), 201
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['PUT'])
def actualizar_racion(racion_id):
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        data = request.get_json() or {}

        if 'nombre' in data:
            nombre = data['nombre'].strip()
            if nombre:
                racion.nombre = nombre

        if 'descripcion' in data:
            racion.descripcion = data['descripcion']

        if 'categorias' in data and isinstance(data['categorias'], list):
            racion.set_categorias(data['categorias'])

        db.session.commit()
        return jsonify({
            'mensaje': 'Ración actualizada',
            'racion': racion.to_dict()
        }), 200
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>', methods=['DELETE'])
def eliminar_racion(racion_id):
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        db.session.delete(racion)
        db.session.commit()
        return jsonify({'mensaje': 'Ración eliminada'}), 200
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos', methods=['POST'])
def agregar_alimento_racion(racion_id):
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        data = request.get_json() or {}
        alimento_id = data.get('alimento_id')
        cantidad = data.get('cantidad', 100)

        if not alimento_id:
            return jsonify({'error': 'alimento_id es requerido'}), 400

        alimento = Alimento.query.get(alimento_id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        existe = db.session.execute(
            select(racion_alimentos).where(
                (racion_alimentos.c.racion_id == racion_id) &
                (racion_alimentos.c.alimento_id == alimento_id)
            )
        ).first()

        if existe:
            return jsonify({'error': 'Este alimento ya está en la ración'}), 409

        stmt = racion_alimentos.insert().values(
            racion_id=racion_id,
            alimento_id=alimento_id,
            cantidad=cantidad
        )
        db.session.execute(stmt)
        db.session.commit()

        db.session.refresh(racion)
        return jsonify({
            'mensaje': 'Alimento agregado a la ración',
            'racion': racion.to_dict()
        }), 201
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos/<int:alimento_id>', methods=['DELETE'])
def remover_alimento_racion(racion_id, alimento_id):
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        # Borrar directamente de la junction table sin depender del ORM
        result = db.session.execute(
            racion_alimentos.delete().where(
                (racion_alimentos.c.racion_id == racion_id) &
                (racion_alimentos.c.alimento_id == alimento_id)
            )
        )

        if result.rowcount == 0:
            return jsonify({'error': 'El alimento no está en esta ración'}), 404

        db.session.commit()
        db.session.expire(racion)
        return jsonify({
            'mensaje': 'Alimento removido de la ración',
            'racion': racion.to_dict()
        }), 200
    except Exception as e:
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/<int:racion_id>/alimentos/<int:alimento_id>', methods=['PUT'])
def actualizar_cantidad_alimento(racion_id, alimento_id):
    try:
        racion = Racion.query.get(racion_id)
        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        alimento = Alimento.query.get(alimento_id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        data = request.get_json() or {}
        cantidad = data.get('cantidad', 100)

        if cantidad <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

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
        _safe_rollback()
        return jsonify({'error': str(e)}), 500


@raciones_bp.route('/sync/diff', methods=['POST'])
@jwt_required()
def verificar_cambios_raciones():
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}
        cliente_count = data.get('count', 0)

        total_raciones = Racion.query.filter_by(usuario_id=usuario_id).count()
        hay_cambios = cliente_count != total_raciones

        return jsonify({
            'hay_cambios': hay_cambios,
            'count_servidor': total_raciones,
            'count_cliente': cliente_count
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
