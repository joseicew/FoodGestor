from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from app import db
from app.models.usuario import Usuario

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

ROLES_VALIDOS = ['superadmin', 'admin', 'usuario', 'limitado']


def _usuario_actual():
    uid = get_jwt_identity()
    if not uid:
        return None
    try:
        return Usuario.query.get(int(uid))
    except (ValueError, TypeError):
        return None


def requiere_rol(*roles):
    """Decorador: exige que el usuario del JWT tenga uno de los roles indicados."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            usuario = _usuario_actual()
            if not usuario:
                return jsonify({'error': 'No autenticado'}), 401
            if usuario.rol not in roles:
                return jsonify({'error': 'No tienes permiso para esta acción'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


@admin_bp.route('/usuarios', methods=['GET'])
@requiere_rol('superadmin', 'admin')
def listar_usuarios():
    usuarios = Usuario.query.order_by(Usuario.email).all()
    return jsonify({'usuarios': [
        {'id': u.id, 'email': u.email, 'nombre_completo': u.nombre_completo, 'rol': u.rol}
        for u in usuarios
    ]}), 200


@admin_bp.route('/usuarios/<int:id>/rol', methods=['PUT'])
@requiere_rol('superadmin')
def cambiar_rol(id):
    data = request.get_json() or {}
    nuevo_rol = (data.get('rol') or '').strip()

    if nuevo_rol not in ROLES_VALIDOS:
        return jsonify({'error': f'Rol inválido. Válidos: {", ".join(ROLES_VALIDOS)}'}), 400

    objetivo = Usuario.query.get(id)
    if not objetivo:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    actual = _usuario_actual()
    # Protecciones: no cambiar el propio rol, ni el de otro superadmin, ni asignar superadmin
    if objetivo.id == actual.id:
        return jsonify({'error': 'No puedes cambiar tu propio rol'}), 400
    if objetivo.rol == 'superadmin':
        return jsonify({'error': 'No se puede cambiar el rol de un superadministrador'}), 400
    if nuevo_rol == 'superadmin':
        return jsonify({'error': 'No se puede asignar el rol de superadministrador'}), 400

    objetivo.rol = nuevo_rol
    db.session.commit()
    return jsonify({
        'mensaje': 'Rol actualizado',
        'usuario': {'id': objetivo.id, 'email': objetivo.email, 'rol': objetivo.rol}
    }), 200
