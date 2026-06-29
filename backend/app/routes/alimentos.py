from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import selectinload
import json
import os
from datetime import datetime
from app import db
from app.models.alimento import Alimento
from app.models.ingrediente import Ingrediente

alimentos_bp = Blueprint('alimentos', __name__, url_prefix='/api/alimentos')

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'alimentos')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _guardar_foto(file, prefijo):
    if file and file.filename and allowed_file(file.filename):
        filename = secure_filename(f"{prefijo}_{datetime.now().timestamp()}_{file.filename}")
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        return f'uploads/alimentos/{filename}'
    return None


def _vincular_ingredientes(alimento, nombres):
    """
    Vincula ingredientes a un alimento, deduplicando automáticamente.
    Si un ingrediente ya existe en la BD con el mismo nombre (case-insensitive),
    lo reutiliza. De lo contrario, lo crea nuevo.
    """
    # Limpiar ingredientes existentes para actualizar la lista
    alimento.ingredientes.clear()

    for item in nombres:
        # Manejar tanto strings como diccionarios
        if isinstance(item, dict):
            nombre = item.get('nombre', '').strip()
        else:
            nombre = str(item).strip()

        if not nombre:
            continue

        # Buscar ingrediente existente (case-insensitive)
        ingrediente = Ingrediente.query.filter(
            db.func.lower(Ingrediente.nombre) == nombre.lower()
        ).first()

        if not ingrediente:
            # Crear nuevo ingrediente con el nombre normalizado
            ingrediente = Ingrediente(nombre=nombre.capitalize())
            db.session.add(ingrediente)
            db.session.flush()  # Asegurar que se guarde antes de vincularlo
            print(f'[NEW] Nuevo ingrediente creado: {nombre}')

        # Vincular al alimento (evita duplicados automáticamente)
        if ingrediente not in alimento.ingredientes:
            alimento.ingredientes.append(ingrediente)
            print(f'[OK] Ingrediente vinculado: {ingrediente.nombre}')


def _calcular_similitud_macros(macros1: dict, macros2: dict, tolerancia: float = 0.1) -> bool:
    """
    Calcula si dos conjuntos de macros son similares (dentro de 10% de tolerancia).
    Retorna True si son similares, False si son diferentes.
    """
    campos = ['calorias', 'proteinas', 'grasas', 'hidratos_carbono']
    coincidencias = 0

    for campo in campos:
        v1 = macros1.get(campo, 0) or 0
        v2 = macros2.get(campo, 0) or 0

        if v1 == 0 and v2 == 0:
            coincidencias += 1
            continue

        if v1 == 0 or v2 == 0:
            continue

        diferencia = abs(v1 - v2) / max(v1, v2)
        if diferencia <= tolerancia:
            coincidencias += 1

    return coincidencias >= 2


@alimentos_bp.route('/duplicado', methods=['POST'])
def verificar_duplicado():
    """Verifica si existe un verdadero duplicado: marca + nombre similar + macros iguales"""
    try:
        data = request.get_json() or {}
        nombre = data.get('nombre', '').strip().lower()
        marca = data.get('marca', '').strip().lower()
        codigo_barras_nuevo = data.get('codigo_barras', '').strip() or None
        macros = {
            'calorias': data.get('calorias', 0),
            'proteinas': data.get('proteinas', 0),
            'grasas': data.get('grasas', 0),
            'hidratos_carbono': data.get('hidratos_carbono', 0)
        }

        if not nombre or not marca:
            return jsonify({'es_duplicado': False, 'duplicado': None}), 200

        alimentos = Alimento.query.all()

        for alimento in alimentos:
            # Marca exacta
            marca_match = alimento.marca.lower() == marca
            if not marca_match:
                continue

            # Nombre similar (al menos 2 palabras en común)
            palabras_nueva = set(nombre.split())
            palabras_existente = set(alimento.nombre.lower().split())
            coincidencias_nombre = palabras_nueva & palabras_existente

            if len(coincidencias_nombre) < 2:
                continue

            # Macros similares
            macros_existente = {
                'calorias': alimento.calorias or 0,
                'proteinas': alimento.proteinas or 0,
                'grasas': alimento.grasas or 0,
                'hidratos_carbono': alimento.hidratos_carbono or 0
            }

            if _calcular_similitud_macros(macros, macros_existente):
                # Es un duplicado verdadero
                # Verificar si el nuevo tiene código y el viejo no
                puede_actualizar_codigo = codigo_barras_nuevo and not alimento.codigo_barras

                return jsonify({
                    'es_duplicado': True,
                    'duplicado': alimento.to_dict(),
                    'puede_actualizar_codigo': puede_actualizar_codigo,
                    'codigo_barras_nuevo': codigo_barras_nuevo
                }), 200

        return jsonify({'es_duplicado': False, 'duplicado': None}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/similar', methods=['POST'])
def buscar_similares():
    """Busca productos con nombre similar para evitar duplicados"""
    try:
        data = request.get_json() or {}
        nombre = data.get('nombre', '').strip().lower()
        marca = data.get('marca', '').strip().lower()

        if not nombre:
            return jsonify({'similares': []}), 200

        alimentos = Alimento.query.all()
        similares = []
        for a in alimentos:
            # Búsqueda por nombre: si contienen palabras comunes
            nombre_existente = a.nombre.lower()
            palabras_nueva = set(nombre.split())
            palabras_existente = set(nombre_existente.split())
            coincidencias = palabras_nueva & palabras_existente

            # También buscar por marca si se proporciona
            marca_match = marca and a.marca.lower() == marca

            if (coincidencias and len(coincidencias) >= 1) or marca_match:
                similares.append(a.to_dict())

        return jsonify({'similares': similares}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/', methods=['GET'])
@jwt_required()
def obtener_alimentos():
    try:
        # Permitir filtrado por código de barras
        codigo_barras = request.args.get('codigo_barras', '').strip()

        # Eager-load de ingredientes (selectinload) para evitar el N+1:
        # sin esto, to_dict() lanzaba una consulta por cada alimento (~2300+).
        query = Alimento.query.options(selectinload(Alimento.ingredientes))

        if codigo_barras:
            alimentos = query.filter(Alimento.codigo_barras == codigo_barras).all()
        else:
            alimentos = query.all()

        return jsonify({'alimentos': [a.to_dict() for a in alimentos]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def obtener_alimento(id):
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404
        return jsonify(alimento.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/', methods=['POST'])
@jwt_required()
def crear_alimento():
    try:
        data = request.form.to_dict()

        if not data.get('nombre'):
            return jsonify({'error': 'El nombre es obligatorio'}), 400

        if not data.get('marca'):
            return jsonify({'error': 'La marca es obligatoria'}), 400

        if not data.get('categoria'):
            return jsonify({'error': 'La categoría es obligatoria'}), 400

        nombre = data.get('nombre', '').strip()
        marca = data.get('marca', '').strip()
        existente_nombre = Alimento.query.filter(
            db.func.lower(Alimento.nombre) == nombre.lower()
        ).first()
        if existente_nombre:
            return jsonify({
                'error': f'Ya existe un alimento llamado "{existente_nombre.nombre}"',
                'producto_existente': existente_nombre.nombre,
                'tipo_duplicado': 'nombre'
            }), 409

        codigo_barras = data.get('codigo_barras', '').strip() or None
        if codigo_barras:
            existente = Alimento.query.filter(Alimento.codigo_barras == codigo_barras).first()
            if existente:
                return jsonify({
                    'error': f'Ya existe un producto con el código "{codigo_barras}"',
                    'producto_existente': existente.nombre,
                    'tipo_duplicado': 'codigo_barras'
                }), 409

        def f(key, cast=float, default=0):
            v = data.get(key, '')
            return cast(v) if v else default

        alimento = Alimento(
            nombre=data.get('nombre'),
            marca=marca,
            descripcion=data.get('descripcion', ''),
            calorias=f('calorias', int),
            proteinas=f('proteinas'),
            grasas=f('grasas'),
            grasas_saturadas=f('grasas_saturadas'),
            hidratos_carbono=f('hidratos_carbono'),
            azucares=f('azucares'),
            fibra=f('fibra'),
            sal=f('sal'),
            sodio=f('sodio'),
            potasio=f('potasio'),
            calcio=f('calcio'),
            hierro=f('hierro'),
            categoria=data.get('categoria', ''),
            codigo_barras=codigo_barras,
            peso_unidad=f('peso_unidad'),
            nombre_unidad=data.get('nombre_unidad', '').strip() or None,
        )

        ruta_ing = _guardar_foto(request.files.get('foto_ingredientes'), 'ingredientes')
        if ruta_ing:
            alimento.foto_ingredientes = ruta_ing

        ruta_mac = _guardar_foto(request.files.get('foto_macros'), 'macros')
        if ruta_mac:
            alimento.foto_macros = ruta_mac

        db.session.add(alimento)

        nombres_ingredientes = json.loads(data.get('ingredientes', '[]') or '[]')
        _vincular_ingredientes(alimento, nombres_ingredientes)

        db.session.commit()

        return jsonify({'mensaje': 'Alimento creado exitosamente', 'alimento': alimento.to_dict()}), 201

    except ValueError as e:
        return jsonify({'error': f'Error en los datos: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def actualizar_alimento(id):
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        data = request.form.to_dict()

        def f(key, current, cast=float):
            return cast(data[key]) if data.get(key) else current

        alimento.nombre = data.get('nombre', alimento.nombre)
        alimento.marca = data.get('marca', alimento.marca)
        alimento.descripcion = data.get('descripcion', alimento.descripcion)
        alimento.calorias = f('calorias', alimento.calorias, int)
        alimento.proteinas = f('proteinas', alimento.proteinas)
        alimento.grasas = f('grasas', alimento.grasas)
        alimento.grasas_saturadas = f('grasas_saturadas', alimento.grasas_saturadas)
        alimento.hidratos_carbono = f('hidratos_carbono', alimento.hidratos_carbono)
        alimento.azucares = f('azucares', alimento.azucares)
        alimento.fibra = f('fibra', alimento.fibra)
        alimento.sal = f('sal', alimento.sal)
        alimento.sodio = f('sodio', alimento.sodio)
        alimento.potasio = f('potasio', alimento.potasio)
        alimento.calcio = f('calcio', alimento.calcio)
        alimento.hierro = f('hierro', alimento.hierro)
        alimento.categoria = data.get('categoria', alimento.categoria)
        alimento.peso_unidad = f('peso_unidad', alimento.peso_unidad)
        alimento.nombre_unidad = data.get('nombre_unidad', alimento.nombre_unidad).strip() or None if data.get('nombre_unidad') else alimento.nombre_unidad

        ruta_ing = _guardar_foto(request.files.get('foto_ingredientes'), 'ingredientes')
        if ruta_ing:
            alimento.foto_ingredientes = ruta_ing

        ruta_mac = _guardar_foto(request.files.get('foto_macros'), 'macros')
        if ruta_mac:
            alimento.foto_macros = ruta_mac

        # Actualizar ingredientes si se proporcionan
        ingredientes_json = data.get('ingredientes', '[]')
        if ingredientes_json:
            try:
                nombres_ingredientes = json.loads(ingredientes_json)
                if nombres_ingredientes:
                    _vincular_ingredientes(alimento, nombres_ingredientes)
            except json.JSONDecodeError:
                pass

        db.session.commit()
        return jsonify({'mensaje': 'Alimento actualizado exitosamente', 'alimento': alimento.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def eliminar_alimento(id):
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404
        db.session.delete(alimento)
        db.session.commit()
        return jsonify({'mensaje': 'Alimento eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/favorito', methods=['POST'])
@jwt_required()
def toggle_favorito(id):
    """Marca/desmarca un alimento como favorito"""
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        alimento.favorito = not alimento.favorito
        db.session.commit()

        return jsonify({
            'mensaje': 'Favorito actualizado',
            'alimento': alimento.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/favoritos/lista', methods=['GET'])
@jwt_required()
def obtener_favoritos():
    """Obtiene solo los alimentos marcados como favoritos"""
    try:
        favoritos = Alimento.query.all()
        return jsonify([a.to_dict() for a in favoritos]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/actualizar-codigo', methods=['POST'])
@jwt_required()
def actualizar_codigo_barras(id):
    """Actualiza solo el código de barras de un alimento"""
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        data = request.get_json() or {}
        codigo_barras = data.get('codigo_barras', '').strip() or None

        if not codigo_barras:
            return jsonify({'error': 'Código de barras es requerido'}), 400

        # Verificar que no existe otro producto con este código
        existente = Alimento.query.filter(Alimento.codigo_barras == codigo_barras).first()
        if existente and existente.id != id:
            return jsonify({
                'error': f'Ya existe un producto con este código',
                'producto_existente': existente.nombre
            }), 409

        alimento.codigo_barras = codigo_barras
        db.session.commit()

        return jsonify({
            'mensaje': 'Código de barras actualizado',
            'alimento': alimento.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/actualizar-alergenos', methods=['POST'])
@jwt_required()
def actualizar_alergenos(id):
    """Actualiza los alergenos y categorías asociados a los ingredientes de un alimento"""
    try:
        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        data = request.get_json() or {}
        ingredientes_data = data.get('ingredientes', [])

        if not ingredientes_data:
            return jsonify({'error': 'No hay ingredientes para actualizar'}), 400

        # Procesar cada ingrediente
        for ing_data in ingredientes_data:
            ing_id = ing_data.get('id')
            nombre = ing_data.get('nombre', '').strip()
            categoria = ing_data.get('categoria', '').strip() or None
            alergenos_categorias = ing_data.get('alergenos_categorias', [])
            verificado = ing_data.get('verificado', False)

            # Obtener o crear ingrediente
            ingrediente = Ingrediente.query.get(ing_id)
            if not ingrediente:
                # Si no existe, crear uno nuevo
                ingrediente = Ingrediente(nombre=nombre, categoria=categoria)
                db.session.add(ingrediente)
                db.session.flush()
            else:
                # Actualizar nombre y categoría
                if nombre:
                    ingrediente.nombre = nombre
                if categoria:
                    ingrediente.categoria = categoria

            # Actualizar categorías alérgenas y marcar como verificado
            ingrediente.set_alergenos_categorias(alergenos_categorias)
            ingrediente.verificado = verificado

        db.session.commit()

        return jsonify({
            'mensaje': 'Alergenos actualizados correctamente',
            'alimento': alimento.to_dict()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/sync/diff', methods=['POST'])
@jwt_required()
def verificar_cambios_alimentos():
    """Verifica si hay cambios en los alimentos desde la última carga"""
    try:
        data = request.get_json() or {}
        cliente_count = data.get('count', 0)

        # Contar alimentos actuales en el servidor
        total_alimentos = Alimento.query.count()

        # Si la cantidad cambió, hay cambios
        hay_cambios = cliente_count != total_alimentos

        return jsonify({
            'hay_cambios': hay_cambios,
            'count_servidor': total_alimentos,
            'count_cliente': cliente_count
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


