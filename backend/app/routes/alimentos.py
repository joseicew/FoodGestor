from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import exists
from sqlalchemy.orm import selectinload
from collections import defaultdict
import json
import unicodedata
from app import db
from app.models.alimento import Alimento, alimento_ingrediente
from app.models.ingrediente import Ingrediente
from app.models.porcion_habitual import PorcionHabitual
from app.services.ingredientes_helper import obtener_o_crear_ingrediente, limpiar_huerfanos_por_ids
from app.routes.admin import requiere_rol

alimentos_bp = Blueprint('alimentos', __name__, url_prefix='/api/alimentos')

# Palabras sin valor para detectar similitud de nombres (no cuentan como coincidencia)
STOPWORDS_NOMBRE = {
    'de', 'del', 'la', 'el', 'los', 'las', 'y', 'con', 'sin',
    'al', 'en', 'para', 'un', 'una', 'unos', 'unas', 'o'
}


def _palabras_significativas(texto: str) -> set:
    return {p for p in texto.lower().split() if p not in STOPWORDS_NOMBRE and len(p) > 2}


def _normalizar_texto(texto):
    texto = (texto or '').strip().lower()
    texto = unicodedata.normalize('NFD', texto)
    texto = ''.join(c for c in texto if unicodedata.category(c) != 'Mn')
    return ' '.join(texto.split())


def _agrupar_alimentos_duplicados():
    """
    Detecta alimentos que probablemente son el mismo producto en distinto
    formato (paquete, cartón, botella, lata...) -la leche o un refresco se
    venden así habitualmente-, agrupando los que tienen el mismo nombre +
    marca (normalizado, sin acentos ni mayúsculas).

    Se probó también agrupar por "misma marca + macros por 100g
    idénticos" para pillar variantes con el nombre ligeramente distinto,
    pero en la práctica genera demasiados falsos positivos: toda la
    pasta seca de una marca comparte los mismos macros típicos, todos
    los refrescos "zero" comparten 0 kcal, los huevos de cualquier
    tamaño tienen la misma composición... nada de eso son duplicados
    reales. El nombre+marca exacto es la única señal lo bastante fiable
    para no generar ruido.
    """
    alimentos = Alimento.query.with_entities(
        Alimento.id, Alimento.nombre, Alimento.marca,
        Alimento.calorias, Alimento.proteinas, Alimento.grasas, Alimento.hidratos_carbono
    ).all()

    grupos_nombre = defaultdict(list)
    for a in alimentos:
        clave = (_normalizar_texto(a.marca), _normalizar_texto(a.nombre))
        grupos_nombre[clave].append(a)

    grupos = []
    for miembros in grupos_nombre.values():
        if len(miembros) < 2:
            continue
        grupos.append({
            'criterio': 'nombre',
            'alimentos': [
                {
                    'id': a.id,
                    'nombre': a.nombre,
                    'marca': a.marca,
                    'calorias': a.calorias,
                    'proteinas': a.proteinas,
                    'grasas': a.grasas,
                    'hidratos_carbono': a.hidratos_carbono,
                }
                for a in miembros
            ],
        })

    grupos.sort(key=lambda g: -len(g['alimentos']))
    return grupos


def _vincular_ingredientes(alimento, nombres):
    """
    Vincula ingredientes a un alimento, deduplicando automáticamente.
    Si un ingrediente ya existe en la BD con el mismo nombre (case-insensitive),
    lo reutiliza. De lo contrario, lo crea nuevo.

    Al reemplazar la lista, los ingredientes que se desvinculan y se
    quedan sin ningún alimento asociado se borran en el acto (hook de
    limpieza de huérfanos), en vez de esperar a la limpieza manual.
    """
    # Recordar quién estaba vinculado antes de reemplazar la lista, para
    # poder detectar huérfanos justo después.
    ids_previos = [i.id for i in alimento.ingredientes]

    alimento.ingredientes.clear()

    for item in nombres:
        # Manejar tanto strings como diccionarios
        if isinstance(item, dict):
            nombre = item.get('nombre', '').strip()
        else:
            nombre = str(item).strip()

        if not nombre:
            continue

        ingrediente = obtener_o_crear_ingrediente(nombre, capitalizar=True)
        if not ingrediente:
            continue

        # Vincular al alimento (evita duplicados automáticamente)
        if ingrediente not in alimento.ingredientes:
            alimento.ingredientes.append(ingrediente)

    if ids_previos:
        db.session.flush()
        borrados = limpiar_huerfanos_por_ids(ids_previos)
        if borrados:
            print(f'[LIMPIEZA] {borrados} ingrediente(s) huérfano(s) eliminados tras editar "{alimento.nombre}"')


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

        # Filtrar por marca exacta en la propia consulta SQL (evita cargar toda la tabla)
        alimentos = Alimento.query.filter(db.func.lower(Alimento.marca) == marca).all()
        palabras_nueva = set(nombre.split())

        for alimento in alimentos:
            # Nombre similar (al menos 2 palabras en común)
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
    """Busca productos con nombre realmente similar (misma categoría + 2+ palabras en común) para evitar duplicados"""
    try:
        data = request.get_json() or {}
        nombre = data.get('nombre', '').strip().lower()
        categoria = data.get('categoria', '').strip()

        if not nombre:
            return jsonify({'similares': []}), 200

        palabras_nueva = _palabras_significativas(nombre)
        if not palabras_nueva:
            return jsonify({'similares': []}), 200

        # Filtrar en la propia consulta SQL por palabras significativas del nombre
        # (evita cargar toda la tabla de alimentos solo para descartar la mayoría en Python)
        condiciones = [Alimento.nombre.ilike(f'%{p}%') for p in palabras_nueva]
        query = Alimento.query.filter(db.or_(*condiciones))
        if categoria:
            query = query.filter(Alimento.categoria == categoria)
        candidatos = query.limit(100).all()

        similares = []
        for a in candidatos:
            palabras_existente = _palabras_significativas(a.nombre)
            coincidencias = palabras_nueva & palabras_existente
            if len(coincidencias) >= 2:
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
            medida_unidad=data.get('medida_unidad', 'g').strip() or 'g',
        )

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
        alimento.medida_unidad = data.get('medida_unidad', alimento.medida_unidad).strip() or alimento.medida_unidad if data.get('medida_unidad') else alimento.medida_unidad

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

        # Recordar sus ingredientes para poder limpiar los que se queden
        # huérfanos tras el borrado (el DELETE solo quita las filas de la
        # tabla puente, no los ingredientes en sí).
        ids_ingredientes = [i.id for i in alimento.ingredientes]

        db.session.delete(alimento)
        db.session.flush()
        borrados = limpiar_huerfanos_por_ids(ids_ingredientes)
        if borrados:
            print(f'[LIMPIEZA] {borrados} ingrediente(s) huérfano(s) eliminados tras borrar "{alimento.nombre}"')

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


@alimentos_bp.route('/<int:id>/porcion-habitual', methods=['GET'])
@jwt_required()
def obtener_porcion_habitual(id):
    """Cantidad (g/ml) que el usuario actual suele añadir de este alimento, si la ha guardado."""
    try:
        usuario_id = int(get_jwt_identity())
        porcion = PorcionHabitual.query.filter_by(usuario_id=usuario_id, alimento_id=id).first()
        return jsonify({'porcion': porcion.to_dict() if porcion else None}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/porcion-habitual', methods=['PUT'])
@jwt_required()
def guardar_porcion_habitual(id):
    """Guarda (o actualiza) la cantidad habitual del usuario actual para este alimento."""
    try:
        usuario_id = int(get_jwt_identity())
        data = request.get_json() or {}
        cantidad = data.get('cantidad')
        if not cantidad or cantidad <= 0:
            return jsonify({'error': 'Cantidad inválida'}), 400

        if not Alimento.query.get(id):
            return jsonify({'error': 'Alimento no encontrado'}), 404

        porcion = PorcionHabitual.query.filter_by(usuario_id=usuario_id, alimento_id=id).first()
        if porcion:
            porcion.cantidad = cantidad
        else:
            porcion = PorcionHabitual(usuario_id=usuario_id, alimento_id=id, cantidad=cantidad)
            db.session.add(porcion)
        db.session.commit()

        return jsonify({'mensaje': 'Porción habitual guardada', 'porcion': porcion.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/porcion-habitual', methods=['DELETE'])
@jwt_required()
def eliminar_porcion_habitual(id):
    """Quita la cantidad habitual guardada por el usuario actual para este alimento."""
    try:
        usuario_id = int(get_jwt_identity())
        porcion = PorcionHabitual.query.filter_by(usuario_id=usuario_id, alimento_id=id).first()
        if porcion:
            db.session.delete(porcion)
            db.session.commit()
        return jsonify({'mensaje': 'Porción habitual eliminada'}), 200
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

            # Obtener o crear ingrediente. Si no viene id, reutilizar por
            # nombre (case-insensitive) en vez de crear a ciegas: evita
            # duplicar un ingrediente que ya existe con otra combinación
            # de mayúsculas/espacios.
            ingrediente = Ingrediente.query.get(ing_id) if ing_id else None
            if not ingrediente:
                ingrediente = obtener_o_crear_ingrediente(nombre, categoria=categoria or '')
                if not ingrediente:
                    continue
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


@alimentos_bp.route('/limpieza/sin-ingredientes', methods=['POST'])
@requiere_rol('superadmin', 'admin')
def listar_alimentos_sin_ingredientes():
    """
    Alimentos sin ningún ingrediente asociado: casi siempre un error al
    crearlos (no tiene sentido que exista un alimento "vacío"). No hay
    forma automática de arreglarlo (no se pueden inventar ingredientes),
    así que solo se lista para que el admin los revise y edite a mano.
    """
    try:
        tiene_ingrediente = exists().where(alimento_ingrediente.c.alimento_id == Alimento.id)
        sin_ingredientes = Alimento.query.filter(~tiene_ingrediente).all()

        # Muchos de estos son alimentos "simples" (una fruta, una verdura...)
        # donde el propio alimento ES el ingrediente (p.ej. alimento "Naranja"
        # e ingrediente "Naranja" ya existente). Se busca de una sola vez
        # (sin N+1) para sugerir el vinculo en vez de obligar a escribirlo.
        ingredientes_por_nombre = {
            nombre.strip().lower(): (ing_id, nombre)
            for ing_id, nombre in db.session.query(Ingrediente.id, Ingrediente.nombre).all()
        }

        alimentos = []
        for a in sin_ingredientes:
            sugerido = ingredientes_por_nombre.get((a.nombre or '').strip().lower())
            alimentos.append({
                'id': a.id,
                'nombre': a.nombre,
                'marca': a.marca,
                'ingrediente_sugerido': {'id': sugerido[0], 'nombre': sugerido[1]} if sugerido else None,
            })

        return jsonify({
            'mensaje': f'{len(alimentos)} alimento(s) sin ingredientes asociados',
            'total': len(alimentos),
            'alimentos': alimentos,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/<int:id>/vincular-ingrediente', methods=['POST'])
@requiere_rol('superadmin', 'admin')
def vincular_ingrediente_sugerido(id):
    """
    Vincula un ingrediente ya existente a un alimento con un solo click,
    para el caso "el alimento es el ingrediente" (p.ej. alimento "Naranja"
    con el ingrediente "Naranja" ya en la BD) detectado en la limpieza de
    alimentos sin ingredientes.
    """
    try:
        data = request.get_json() or {}
        ingrediente_id = data.get('ingrediente_id')
        if not ingrediente_id:
            return jsonify({'error': 'Falta ingrediente_id'}), 400

        alimento = Alimento.query.get(id)
        if not alimento:
            return jsonify({'error': 'Alimento no encontrado'}), 404

        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        if ingrediente not in alimento.ingredientes:
            alimento.ingredientes.append(ingrediente)
            db.session.commit()

        return jsonify({'mensaje': 'Ingrediente vinculado', 'alimento': alimento.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@alimentos_bp.route('/limpieza/posibles-duplicados', methods=['POST'])
@requiere_rol('superadmin', 'admin')
def listar_alimentos_duplicados():
    """
    Alimentos que probablemente son el mismo producto vendido en distinto
    formato (p.ej. leche en cartón vs en pack, refresco en lata vs
    botella): mismo nombre+marca, o misma marca con macros por 100g
    identicos. No se fusiona nada automaticamente (a diferencia de los
    ingredientes duplicados, borrar/fusionar un alimento afecta a
    raciones y calendario ya guardados), solo se lista para revision.
    """
    try:
        grupos = _agrupar_alimentos_duplicados()
        total = sum(len(g['alimentos']) - 1 for g in grupos)
        return jsonify({
            'mensaje': f'{len(grupos)} grupo(s) de posibles duplicados ({total} alimento(s) de más)',
            'total': total,
            'grupos': grupos,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


