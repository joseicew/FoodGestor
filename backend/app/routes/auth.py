from flask import Blueprint, request, jsonify
from app import db
from app.models.usuario import Usuario
from app.models.peso_historico import PesoHistorico
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import date, timedelta

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


@auth_bp.route('/debug-token', methods=['POST'])
def debug_token():
    """Debug endpoint para verificar token"""
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header:
            return jsonify({'error': 'No Authorization header', 'has_token': False}), 400

        token = auth_header.split(' ')[1] if ' ' in auth_header else ''
        if not token:
            return jsonify({'error': 'Invalid Authorization format', 'has_token': False}), 400

        return jsonify({
            'has_token': True,
            'token_length': len(token),
            'token_preview': token[:20] + '...',
            'message': 'Token received'
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
            nuevo_peso = data['peso']
            usuario.peso = nuevo_peso
            # Registrar en historial (upsert por fecha)
            from datetime import date as _date
            hoy = _date.today()
            registro_peso = PesoHistorico.query.filter_by(usuario_id=usuario.id, fecha=hoy).first()
            if registro_peso:
                registro_peso.peso = nuevo_peso
            else:
                db.session.add(PesoHistorico(usuario_id=usuario.id, fecha=hoy, peso=nuevo_peso))
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

        import json

        # Actualizar alergenos seleccionados
        if 'alergenos_seleccionados' in data:
            if isinstance(data['alergenos_seleccionados'], list):
                usuario.alergenos_seleccionados = json.dumps(data['alergenos_seleccionados'])
            else:
                usuario.alergenos_seleccionados = '[]'

        # Actualizar ingredientes no deseados
        if 'ingredientes_no_deseados' in data:
            if isinstance(data['ingredientes_no_deseados'], list):
                usuario.ingredientes_no_deseados = json.dumps(data['ingredientes_no_deseados'])
            else:
                usuario.ingredientes_no_deseados = '[]'

        db.session.commit()

        return jsonify(usuario.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/peso-historico', methods=['GET'])
@jwt_required()
def obtener_peso_historico():
    """Devuelve el historial de peso del usuario (últimos N días)"""
    try:
        usuario_id = get_jwt_identity()
        dias = int(request.args.get('dias', 30))
        desde = date.today() - timedelta(days=dias)
        registros = PesoHistorico.query.filter(
            PesoHistorico.usuario_id == usuario_id,
            PesoHistorico.fecha >= desde
        ).order_by(PesoHistorico.fecha).all()
        return jsonify([r.to_dict() for r in registros]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/peso-historico', methods=['POST'])
@jwt_required()
def registrar_peso():
    """Registra o actualiza el peso del usuario para una fecha (por defecto hoy)"""
    try:
        usuario_id = get_jwt_identity()
        data = request.get_json()
        peso = data.get('peso')
        if peso is None or peso <= 0:
            return jsonify({'error': 'Peso inválido'}), 400

        fecha_str = data.get('fecha')
        fecha = date.fromisoformat(fecha_str) if fecha_str else date.today()

        # Upsert: si ya hay registro para esa fecha, actualiza
        registro = PesoHistorico.query.filter_by(usuario_id=usuario_id, fecha=fecha).first()
        if registro:
            registro.peso = peso
        else:
            registro = PesoHistorico(usuario_id=usuario_id, fecha=fecha, peso=peso)
            db.session.add(registro)

        # Actualizar también el peso actual del perfil
        usuario = Usuario.query.get(usuario_id)
        if usuario:
            usuario.peso = peso
            usuario.calcular_limites_base()

        db.session.commit()
        return jsonify(registro.to_dict()), 201
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
