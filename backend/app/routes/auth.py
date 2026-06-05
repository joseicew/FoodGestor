from flask import Blueprint, request, jsonify
from app import db
from app.models.usuario import Usuario
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/registro', methods=['POST'])
def registro():
    """Registra un nuevo usuario"""
    try:
        data = request.get_json()

        # Validar campos obligatorios
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña son requeridos'}), 400

        # Verificar que el email no exista
        usuario_existente = Usuario.query.filter_by(email=data['email']).first()
        if usuario_existente:
            return jsonify({'error': 'Email ya registrado'}), 409

        # Crear nuevo usuario
        usuario = Usuario(
            email=data['email'],
            nombre_completo=data.get('nombre_completo', 'Usuario'),
            edad=30,
            sexo='M',
            altura=170,
            peso=70,
            nivel_actividad='moderado',
            objetivo='mantener'
        )
        usuario.set_password(data['password'])

        # Calcular límites base automáticamente
        usuario.calcular_limites_base()

        db.session.add(usuario)
        db.session.commit()

        # Crear token (identity debe ser string para flask-jwt-extended)
        token = create_access_token(identity=str(usuario.id))

        return jsonify({
            'token': token,
            'usuario': usuario.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Autentica un usuario y retorna un token JWT"""
    try:
        data = request.get_json()

        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña son requeridos'}), 400

        # Buscar usuario
        usuario = Usuario.query.filter_by(email=data['email']).first()

        # Verificar si el usuario existe
        if not usuario:
            return jsonify({'error': 'Este email no está registrado'}), 401

        # Verificar contraseña
        if not usuario.check_password(data['password']):
            return jsonify({'error': 'Contraseña incorrecta'}), 401

        # Crear token (identity debe ser string para flask-jwt-extended)
        token = create_access_token(identity=str(usuario.id))

        return jsonify({
            'token': token,
            'usuario': usuario.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def obtener_perfil():
    """Obtiene los datos del usuario autenticado"""
    try:
        usuario_id = get_jwt_identity()
        usuario = Usuario.query.get(usuario_id)

        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        return jsonify(usuario.to_dict()), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/perfil', methods=['PUT'])
@jwt_required()
def actualizar_perfil():
    """Actualiza los datos del usuario autenticado"""
    try:
        usuario_id = get_jwt_identity()
        usuario = Usuario.query.get(usuario_id)

        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        data = request.get_json()

        # Actualizar campos permitidos
        if 'nombre_completo' in data:
            usuario.nombre_completo = data['nombre_completo']
        if 'edad' in data:
            usuario.edad = data['edad']
        if 'sexo' in data:
            usuario.sexo = data['sexo']
        if 'altura' in data:
            usuario.altura = data['altura']
        if 'peso' in data:
            usuario.peso = data['peso']
        if 'nivel_actividad' in data:
            usuario.nivel_actividad = data['nivel_actividad']
        if 'objetivo' in data:
            usuario.objetivo = data['objetivo']

        # Si se actualizaron datos de cálculo, recalcular límites automáticamente
        if any(key in data for key in ['edad', 'peso', 'altura', 'nivel_actividad', 'objetivo']):
            usuario.calcular_limites_base()

        # Permitir actualización manual de límites
        if 'limites_calorias' in data:
            usuario.limites_calorias = data['limites_calorias']
        if 'limites_proteinas' in data:
            usuario.limites_proteinas = data['limites_proteinas']
        if 'limites_grasas' in data:
            usuario.limites_grasas = data['limites_grasas']
        if 'limites_carbohidratos' in data:
            usuario.limites_carbohidratos = data['limites_carbohidratos']
        if 'limites_azucares' in data:
            usuario.limites_azucares = data['limites_azucares']

        db.session.commit()

        return jsonify(usuario.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Endpoint para logout (opcional, manejo del lado del cliente)"""
    try:
        # En JWT puro, el logout se maneja del lado del cliente eliminando el token
        # Este endpoint puede ser útil para auditoría
        return jsonify({'mensaje': 'Sesión cerrada'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
