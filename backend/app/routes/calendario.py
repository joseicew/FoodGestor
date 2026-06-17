from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.comida_diaria import ComidaDiaria, comida_raciones, comida_alimentos
from app.models.racion import Racion
from app.models.alimento import Alimento
from datetime import datetime
from sqlalchemy import select

calendario_bp = Blueprint('calendario', __name__, url_prefix='/api/calendario')

# Límites base por defecto (kcal, proteínas, grasas, azúcares)
# OMS: azúcares menos del 10% de calorías diarias (2500 * 0.10 / 4 = 62.5g)
LIMITES_BASE_DEFECTO = {
    'calorias': 2500,
    'proteinas': 100,
    'grasas': 80,
    'azucares': 62
}


def obtener_dia_completo(fecha_str, usuario_id=None):
    """Obtiene todas las comidas de un día"""
    try:
        fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()
    except ValueError:
        return None

    if usuario_id:
        comidas_diarias = ComidaDiaria.query.filter_by(fecha=fecha, usuario_id=usuario_id).all()
    else:
        comidas_diarias = ComidaDiaria.query.filter_by(fecha=fecha).all()

    # Crear estructura de 5 comidas
    estructura_dia = {
        'desayuno': None,
        'almuerzo': None,
        'comida': None,
        'merienda': None,
        'cena': None
    }

    # Llenar con datos existentes
    for comida in comidas_diarias:
        estructura_dia[comida.tipo_comida] = comida.to_dict()

    # Crear comidas vacías si no existen
    for tipo_comida in estructura_dia:
        if estructura_dia[tipo_comida] is None:
            estructura_dia[tipo_comida] = {
                'id': None,
                'fecha': fecha_str,
                'tipo_comida': tipo_comida,
                'raciones': [],
                'alimentos': [],
                'totales': {
                    'calorias': 0,
                    'proteinas': 0,
                    'grasas': 0,
                    'hidratos_carbono': 0,
                    'fibra': 0,
                    'azucares': 0,
                    'grasas_saturadas': 0,
                    'sal': 0,
                    'sodio': 0,
                    'potasio': 0,
                    'calcio': 0,
                    'hierro': 0
                },
                'created_at': None,
                'updated_at': None
            }

    return estructura_dia


def calcular_totales_diarios(comidas):
    """Calcula totales diarios de todas las comidas"""
    totales = {
        'calorias': 0,
        'proteinas': 0,
        'grasas': 0,
        'hidratos_carbono': 0,
        'fibra': 0,
        'azucares': 0,
        'grasas_saturadas': 0,
        'sal': 0,
        'sodio': 0,
        'potasio': 0,
        'calcio': 0,
        'hierro': 0
    }

    for comida in comidas.values():
        if comida and comida.get('totales'):
            for key in totales:
                totales[key] += comida['totales'].get(key, 0)

    return totales


def calcular_porcentajes(totales_diarios, limites_base):
    """Calcula porcentajes respecto a límites base"""
    porcentajes = {}
    for key in limites_base:
        if limites_base[key] > 0:
            porcentajes[key] = round((totales_diarios[key] / limites_base[key]) * 100, 1)
        else:
            porcentajes[key] = 0
    return porcentajes


@calendario_bp.route('/<fecha>', methods=['GET'])
@jwt_required()
def obtener_dia(fecha):
    """Obtiene todas las comidas de un día con cálculo de totales"""
    try:
        usuario_id = int(get_jwt_identity())
        comidas = obtener_dia_completo(fecha, usuario_id)
        if comidas is None:
            return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400

        totales_diarios = calcular_totales_diarios(comidas)
        limites_base = LIMITES_BASE_DEFECTO  # TODO: obtener del perfil del usuario
        porcentajes = calcular_porcentajes(totales_diarios, limites_base)

        return jsonify({
            'fecha': fecha,
            'comidas': comidas,
            'totales_diarios': totales_diarios,
            'limites_base': limites_base,
            'porcentajes': porcentajes
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/raciones', methods=['POST'])
@jwt_required()
def agregar_racion(fecha, tipo_comida):
    """Agrega una ración a una comida del día"""
    try:
        usuario_id = int(get_jwt_identity())
        datos = request.get_json() or {}
        racion_id = datos.get('racion_id')
        cantidad = datos.get('cantidad', 1)

        if not racion_id:
            return jsonify({'error': 'racion_id es requerido'}), 400

        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        racion = Racion.query.filter_by(id=racion_id, usuario_id=usuario_id).first()

        if not racion:
            return jsonify({'error': 'Ración no encontrada'}), 404

        # Obtener o crear ComidaDiaria
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()
        if not comida_diaria:
            comida_diaria = ComidaDiaria(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id)
            db.session.add(comida_diaria)
            db.session.flush()

        # Verificar si la ración ya existe en esta comida
        existe = db.session.execute(
            select(comida_raciones).where(
                (comida_raciones.c.comida_diaria_id == comida_diaria.id) &
                (comida_raciones.c.racion_id == racion_id)
            )
        ).first()

        if existe:
            # Actualizar cantidad
            db.session.execute(
                comida_raciones.update().where(
                    (comida_raciones.c.comida_diaria_id == comida_diaria.id) &
                    (comida_raciones.c.racion_id == racion_id)
                ).values(cantidad=cantidad)
            )
        else:
            # Insertar nueva relación
            stmt = comida_raciones.insert().values(
                comida_diaria_id=comida_diaria.id,
                racion_id=racion_id,
                cantidad=cantidad
            )
            db.session.execute(stmt)

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Ración agregada a la comida',
            'comida': comida_diaria.to_dict()
        }), 201

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/alimentos', methods=['POST'])
@jwt_required()
def agregar_alimento(fecha, tipo_comida):
    """Agrega un alimento a una comida del día"""
    try:
        usuario_id = int(get_jwt_identity())
        datos = request.get_json() or {}
        alimento_id = datos.get('alimento_id')
        cantidad = datos.get('cantidad', 100)

        if not alimento_id:
            return jsonify({'error': 'alimento_id es requerido'}), 400

        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        alimento = Alimento.query.get(alimento_id)

        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        # Obtener o crear ComidaDiaria
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()
        if not comida_diaria:
            comida_diaria = ComidaDiaria(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id)
            db.session.add(comida_diaria)
            db.session.flush()

        # Verificar si el alimento ya existe en esta comida
        existe = db.session.execute(
            select(comida_alimentos).where(
                (comida_alimentos.c.comida_diaria_id == comida_diaria.id) &
                (comida_alimentos.c.alimento_id == alimento_id)
            )
        ).first()

        if existe:
            # Actualizar cantidad
            db.session.execute(
                comida_alimentos.update().where(
                    (comida_alimentos.c.comida_diaria_id == comida_diaria.id) &
                    (comida_alimentos.c.alimento_id == alimento_id)
                ).values(cantidad=cantidad)
            )
        else:
            # Insertar nueva relación
            stmt = comida_alimentos.insert().values(
                comida_diaria_id=comida_diaria.id,
                alimento_id=alimento_id,
                cantidad=cantidad
            )
            db.session.execute(stmt)

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Alimento agregado a la comida',
            'comida': comida_diaria.to_dict()
        }), 201

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        import traceback
        db.session.rollback()
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/raciones/<int:racion_id>', methods=['DELETE'])
@jwt_required()
def remover_racion(fecha, tipo_comida, racion_id):
    """Remueve una ración de una comida"""
    try:
        usuario_id = int(get_jwt_identity())
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()

        if not comida_diaria:
            return jsonify({'error': 'Comida no encontrada'}), 404

        db.session.execute(
            comida_raciones.delete().where(
                (comida_raciones.c.comida_diaria_id == comida_diaria.id) &
                (comida_raciones.c.racion_id == racion_id)
            )
        )

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Ración removida',
            'comida': comida_diaria.to_dict()
        }), 200

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/alimentos/<int:alimento_id>', methods=['DELETE'])
@jwt_required()
def remover_alimento(fecha, tipo_comida, alimento_id):
    """Remueve un alimento de una comida"""
    try:
        usuario_id = int(get_jwt_identity())
        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()

        if not comida_diaria:
            return jsonify({'error': 'Comida no encontrada'}), 404

        db.session.execute(
            comida_alimentos.delete().where(
                (comida_alimentos.c.comida_diaria_id == comida_diaria.id) &
                (comida_alimentos.c.alimento_id == alimento_id)
            )
        )

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Alimento removido',
            'comida': comida_diaria.to_dict()
        }), 200

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/raciones/<int:racion_id>', methods=['PUT'])
@jwt_required()
def actualizar_cantidad_racion(fecha, tipo_comida, racion_id):
    """Actualiza la cantidad de una ración en una comida"""
    try:
        usuario_id = int(get_jwt_identity())
        datos = request.get_json() or {}
        cantidad = datos.get('cantidad', 1)

        if cantidad <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()

        if not comida_diaria:
            return jsonify({'error': 'Comida no encontrada'}), 404

        db.session.execute(
            comida_raciones.update().where(
                (comida_raciones.c.comida_diaria_id == comida_diaria.id) &
                (comida_raciones.c.racion_id == racion_id)
            ).values(cantidad=cantidad)
        )

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Cantidad actualizada',
            'comida': comida_diaria.to_dict()
        }), 200

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/<fecha>/<tipo_comida>/alimentos/<int:alimento_id>', methods=['PUT'])
@jwt_required()
def actualizar_cantidad_alimento(fecha, tipo_comida, alimento_id):
    """Actualiza la cantidad de un alimento en una comida"""
    try:
        usuario_id = int(get_jwt_identity())
        datos = request.get_json() or {}
        cantidad = datos.get('cantidad', 100)

        if cantidad <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a 0'}), 400

        fecha_obj = datetime.strptime(fecha, '%Y-%m-%d').date()
        comida_diaria = ComidaDiaria.query.filter_by(fecha=fecha_obj, tipo_comida=tipo_comida, usuario_id=usuario_id).first()

        if not comida_diaria:
            return jsonify({'error': 'Comida no encontrada'}), 404

        db.session.execute(
            comida_alimentos.update().where(
                (comida_alimentos.c.comida_diaria_id == comida_diaria.id) &
                (comida_alimentos.c.alimento_id == alimento_id)
            ).values(cantidad=cantidad)
        )

        db.session.commit()
        db.session.refresh(comida_diaria)

        return jsonify({
            'mensaje': 'Cantidad actualizada',
            'comida': comida_diaria.to_dict()
        }), 200

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (use YYYY-MM-DD)'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@calendario_bp.route('/sync/diff', methods=['POST'])
@jwt_required()
def verificar_cambios_calendario():
    """Verifica si hay cambios en el calendario del usuario desde la última carga"""
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}
        cliente_count = data.get('count', 0)

        # Contar entradas de calendario actuales en el servidor para este usuario
        total_calendario = ComidaDiaria.query.filter_by(usuario_id=usuario_id).count()

        # Si la cantidad cambió, hay cambios
        hay_cambios = cliente_count != total_calendario

        return jsonify({
            'hay_cambios': hay_cambios,
            'count_servidor': total_calendario,
            'count_cliente': cliente_count
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
