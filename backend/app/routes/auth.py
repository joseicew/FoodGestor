from flask import Blueprint, request, jsonify
from app import db, mail
from app.models.usuario import Usuario
from app.models.peso_historico import PesoHistorico
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message
from datetime import date, datetime, timedelta
import secrets
import os

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


def _enviar_email_reset(email, token):
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:4200')
    link = f"{frontend_url}/resetear-password?token={token}"
    try:
        msg = Message(
            subject='Recuperar contraseña — FoodGestor',
            recipients=[email],
            html=f"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <h2 style="color:#5A7A0F">FoodGestor</h2>
              <p>Recibimos una solicitud para restablecer tu contraseña.</p>
              <p>Haz clic en el botón para crear una nueva contraseña (válido 1 hora):</p>
              <a href="{link}"
                 style="display:inline-block;background:#A4C639;color:#fff;padding:12px 24px;
                        border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
                Restablecer contraseña
              </a>
              <p style="color:#999;font-size:12px">Si no solicitaste esto, ignora este email.</p>
            </div>
            """
        )
        mail.send(msg)
    except Exception as e:
        import logging
        logging.warning(f"Error enviando email de reset: {e}")


@auth_bp.route('/solicitar-reset', methods=['POST'])
def solicitar_reset():
    try:
        data = request.get_json()
        email = (data.get('email') or '').strip()
        if not email:
            return jsonify({'error': 'Email requerido'}), 400

        usuario = Usuario.query.filter_by(email=email).first()
        if usuario:
            token = secrets.token_urlsafe(32)
            usuario.reset_token = token
            usuario.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
            db.session.commit()
            _enviar_email_reset(email, token)

        # Siempre responder igual (no revelar si el email existe)
        return jsonify({'mensaje': 'Si el email está registrado recibirás un enlace de recuperación'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/resetear-password', methods=['POST'])
def resetear_password():
    try:
        data = request.get_json()
        token = (data.get('token') or '').strip()
        nueva_password = data.get('nueva_password', '')

        if not token or not nueva_password:
            return jsonify({'error': 'Token y nueva contraseña son requeridos'}), 400
        if len(nueva_password) < 6:
            return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400

        usuario = Usuario.query.filter_by(reset_token=token).first()
        if not usuario or not usuario.reset_token_expiry or usuario.reset_token_expiry < datetime.utcnow():
            return jsonify({'error': 'El enlace es inválido o ha expirado'}), 400

        usuario.set_password(nueva_password)
        usuario.reset_token = None
        usuario.reset_token_expiry = None
        db.session.commit()
        return jsonify({'mensaje': 'Contraseña actualizada correctamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/cambiar-password', methods=['PUT'])
@jwt_required()
def cambiar_password():
    try:
        usuario_id = get_jwt_identity()
        usuario = Usuario.query.get(usuario_id)
        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        data = request.get_json()
        password_actual = data.get('password_actual', '')
        nueva_password = data.get('nueva_password', '')

        if not password_actual or not nueva_password:
            return jsonify({'error': 'Contraseña actual y nueva son requeridas'}), 400
        if not usuario.check_password(password_actual):
            return jsonify({'error': 'La contraseña actual es incorrecta'}), 401
        if len(nueva_password) < 6:
            return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres'}), 400

        usuario.set_password(nueva_password)
        db.session.commit()
        return jsonify({'mensaje': 'Contraseña actualizada correctamente'}), 200
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
