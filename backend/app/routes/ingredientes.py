from flask import Blueprint, request, jsonify
from app import db
from app.models.ingrediente import Ingrediente

ingredientes_bp = Blueprint('ingredientes', __name__, url_prefix='/api/ingredientes')


@ingredientes_bp.route('/', methods=['GET'])
def obtener_ingredientes():
    """Obtener lista de ingredientes"""
    try:
        es_aditivo = request.args.get('es_aditivo', None)

        query = Ingrediente.query

        if es_aditivo is not None:
            es_aditivo = es_aditivo.lower() == 'true'
            query = query.filter_by(es_aditivo=es_aditivo)

        ingredientes = query.order_by(Ingrediente.nombre).all()

        return jsonify({
            'ingredientes': [ing.to_dict() for ing in ingredientes],
            'total': len(ingredientes)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['GET'])
def obtener_ingrediente(ingrediente_id):
    """Obtener un ingrediente específico"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        return jsonify(ingrediente.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/', methods=['POST'])
def crear_ingrediente():
    """Crear un nuevo ingrediente"""
    try:
        data = request.get_json()

        if not data or 'nombre' not in data:
            return jsonify({'error': 'nombre es requerido'}), 400

        # Verificar que no exista
        if Ingrediente.query.filter_by(nombre=data['nombre']).first():
            return jsonify({'error': 'Este ingrediente ya existe'}), 409

        ingrediente = Ingrediente(
            nombre=data['nombre'],
            categoria=data.get('categoria', ''),
            es_aditivo=data.get('es_aditivo', False),
            notas=data.get('notas', ''),
            verificado=data.get('verificado', False)
        )

        # Asignar categorías de alergenos si vienen en la request
        if 'alergenos_categorias' in data and isinstance(data['alergenos_categorias'], list):
            ingrediente.set_alergenos_categorias(data['alergenos_categorias'])

        db.session.add(ingrediente)
        db.session.commit()

        return jsonify({
            'mensaje': 'Ingrediente creado exitosamente',
            'ingrediente': ingrediente.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['PUT'])
def actualizar_ingrediente(ingrediente_id):
    """Actualizar un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        data = request.get_json()

        if 'nombre' in data:
            ingrediente.nombre = data['nombre']
        if 'categoria' in data:
            ingrediente.categoria = data['categoria']
        if 'es_aditivo' in data:
            ingrediente.es_aditivo = data['es_aditivo']
        if 'notas' in data:
            ingrediente.notas = data['notas']
        if 'verificado' in data:
            ingrediente.verificado = data['verificado']

        # Actualizar categorías de alergenos si vienen en la request
        if 'alergenos_categorias' in data and isinstance(data['alergenos_categorias'], list):
            ingrediente.set_alergenos_categorias(data['alergenos_categorias'])

        db.session.commit()

        return jsonify({
            'mensaje': 'Ingrediente actualizado',
            'ingrediente': ingrediente.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>', methods=['DELETE'])
def eliminar_ingrediente(ingrediente_id):
    """Eliminar un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        db.session.delete(ingrediente)
        db.session.commit()

        return jsonify({'mensaje': 'Ingrediente eliminado'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/alergenos-categorias/disponibles', methods=['GET'])
def obtener_alergenos_disponibles():
    """Obtener las categorías de alergenos/intolerancias disponibles"""
    try:
        from app.models.ingrediente import ALERGENO_CATEGORIAS
        return jsonify({
            'categorias': ALERGENO_CATEGORIAS
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/alimentos-categorias/disponibles', methods=['GET'])
def obtener_alimentos_categorias():
    """Obtener las categorías de alimentos disponibles"""
    try:
        from app.models.ingrediente import ALIMENTOS_CATEGORIAS
        return jsonify({
            'categorias': ALIMENTOS_CATEGORIAS
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/<int:ingrediente_id>/alergenos-categorias', methods=['GET'])
def obtener_alergenos_ingrediente(ingrediente_id):
    """Obtener categorías de alergenos de un ingrediente"""
    try:
        ingrediente = Ingrediente.query.get(ingrediente_id)
        if not ingrediente:
            return jsonify({'error': 'Ingrediente no encontrado'}), 404

        return jsonify({
            'ingrediente_id': ingrediente_id,
            'nombre': ingrediente.nombre,
            'alergenos_categorias': ingrediente.get_alergenos_categorias(),
            'verificado': ingrediente.verificado
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/limpieza/orfanos', methods=['POST'])
def limpiar_ingredientes_orfanos():
    """
    Elimina ingredientes que no están vinculados a ningún alimento.
    Ayuda a reducir la cantidad de ingredientes huérfanos en la BD.
    """
    try:
        # Obtener todos los ingredientes
        ingredientes = Ingrediente.query.all()

        eliminar_count = 0
        ingredientes_eliminados = []

        for ing in ingredientes:
            # Si el ingrediente no tiene alimentos vinculados
            if not ing.alimentos:
                ingredientes_eliminados.append(ing.nombre)
                db.session.delete(ing)
                eliminar_count += 1

        db.session.commit()

        return jsonify({
            'mensaje': f'Se eliminaron {eliminar_count} ingredientes huérfanos',
            'cantidad_eliminados': eliminar_count,
            'ingredientes': ingredientes_eliminados
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ingredientes_bp.route('/limpieza/duplicados', methods=['POST'])
def consolidar_ingredientes_duplicados():
    """
    Elimina ingredientes duplicados consolidando sus datos:
    1. Identifica ingredientes con mismo nombre (case-insensitive)
    2. Mantiene el "principal" (normalmente el más antiguo o verificado)
    3. Transfiere todos los alimentos del duplicado al principal
    4. Asegura que ningún alimento pierda el ingrediente
    5. Elimina el duplicado SOLO después de transferir exitosamente

    Retorna detalles de consolidaciones realizadas.
    """
    try:
        from collections import defaultdict
        from app.models.alimento import Alimento

        # Agrupar ingredientes por nombre normalizado
        grupos_duplicados = defaultdict(list)

        for ing in Ingrediente.query.all():
            nombre_normalizado = ing.nombre.lower().strip()
            grupos_duplicados[nombre_normalizado].append(ing)

        consolidaciones = []
        ingredientes_eliminados = []
        errores = []

        # Procesar cada grupo de duplicados
        for nombre_norm, ingredientes in grupos_duplicados.items():
            if len(ingredientes) <= 1:
                continue  # No hay duplicados

            # Ordenar por: verificado (desc), created_at (asc), id (asc)
            # Mantener el ingrediente verificado o más antiguo como principal
            ingredientes.sort(
                key=lambda x: (-x.verificado, x.created_at, x.id)
            )

            ingrediente_principal = ingredientes[0]
            duplicados = ingredientes[1:]

            print(f'🔀 Consolidando "{ingrediente_principal.nombre}":')
            print(f'   Principal: ID={ingrediente_principal.id} ({len(ingrediente_principal.alimentos)} alimentos)')

            for dup in duplicados:
                alimentos_dup = list(dup.alimentos)  # Copiar la lista antes de modificar
                print(f'   Duplicado: ID={dup.id} "{dup.nombre}" ({len(alimentos_dup)} alimentos)')

                # PASO 1: Transferir todos los alimentos del duplicado al principal
                alimentos_transferidos = 0
                for alimento in alimentos_dup:
                    # Verificar que el alimento actual tiene este ingrediente
                    if dup not in alimento.ingredientes:
                        errores.append({
                            'tipo': 'inconsistencia',
                            'mensaje': f'Alimento "{alimento.nombre}" no tiene ingrediente "{dup.nombre}" en su lista'
                        })
                        continue

                    # Agregar el principal si no está ya
                    if ingrediente_principal not in alimento.ingredientes:
                        alimento.ingredientes.append(ingrediente_principal)
                        print(f'      ✓ Alimento "{alimento.nombre}" vinculado a principal')
                        alimentos_transferidos += 1
                    else:
                        print(f'      ~ Alimento "{alimento.nombre}" ya tenía principal vinculado')
                        alimentos_transferidos += 1

                # PASO 2: Validar que todos los alimentos ahora tienen el principal
                for alimento in alimentos_dup:
                    if ingrediente_principal not in alimento.ingredientes:
                        error_msg = f'CRÍTICO: Alimento "{alimento.nombre}" NO tiene principal vinculado'
                        print(f'      ❌ {error_msg}')
                        errores.append({
                            'tipo': 'error_crítico',
                            'alimento_id': alimento.id,
                            'alimento_nombre': alimento.nombre,
                            'mensaje': error_msg
                        })
                        # NO continuar si hay error crítico
                        raise Exception(error_msg)

                # PASO 3: Eliminar el duplicado SOLO si todo salió bien
                print(f'      🗑️ Eliminando duplicado ID={dup.id}')
                ingredientes_eliminados.append({
                    'id': dup.id,
                    'nombre': dup.nombre,
                    'alimentos_transferidos': alimentos_transferidos
                })

                # Registrar consolidación
                consolidaciones.append({
                    'principal_id': ingrediente_principal.id,
                    'principal_nombre': ingrediente_principal.nombre,
                    'duplicado_id': dup.id,
                    'duplicado_nombre': dup.nombre,
                    'alimentos_transferidos': alimentos_transferidos
                })

                db.session.delete(dup)

        db.session.commit()

        respuesta = {
            'mensaje': f'Se consolidaron {len(consolidaciones)} grupos de ingredientes duplicados',
            'consolidaciones': consolidaciones,
            'total_consolidados': len(consolidaciones),
            'total_eliminados': len(ingredientes_eliminados),
            'ingredientes_eliminados': ingredientes_eliminados
        }

        if errores:
            respuesta['advertencias'] = errores

        return jsonify(respuesta), 200

    except Exception as e:
        db.session.rollback()
        print(f'❌ Error en consolidación: {str(e)}')
        return jsonify({
            'error': str(e),
            'tipo': 'consolidacion_fallida'
        }), 500


@ingredientes_bp.route('/diagnostico/stats', methods=['GET'])
def obtener_estadisticas_ingredientes():
    """
    Obtiene estadísticas sobre ingredientes: total, huérfanos, verificados, etc.
    Útil para diagnosticar la base de datos.
    """
    try:
        from app.models.alimento import Alimento

        total_ingredientes = Ingrediente.query.count()
        total_alimentos = Alimento.query.count()

        # Contar ingredientes huérfanos (sin alimentos)
        ingredientes_huerfanos = []
        for ing in Ingrediente.query.all():
            if not ing.alimentos:
                ingredientes_huerfanos.append({
                    'id': ing.id,
                    'nombre': ing.nombre,
                    'categoria': ing.categoria
                })

        verificados = Ingrediente.query.filter_by(verificado=True).count()
        no_verificados = Ingrediente.query.filter_by(verificado=False).count()
        aditivos = Ingrediente.query.filter_by(es_aditivo=True).count()

        # Detectar posibles duplicados (mismo nombre case-insensitive)
        posibles_duplicados = []
        nombres_vistos = {}
        for ing in Ingrediente.query.all():
            nombre_norm = ing.nombre.lower().strip()
            if nombre_norm not in nombres_vistos:
                nombres_vistos[nombre_norm] = []
            nombres_vistos[nombre_norm].append(ing.id)

        for nombre_norm, ids in nombres_vistos.items():
            if len(ids) > 1:
                posibles_duplicados.append({
                    'nombre_normalizado': nombre_norm,
                    'ids': ids,
                    'cantidad': len(ids)
                })

        return jsonify({
            'total_ingredientes': total_ingredientes,
            'total_alimentos': total_alimentos,
            'ingredientes_huerfanos_count': len(ingredientes_huerfanos),
            'ingredientes_huerfanos': ingredientes_huerfanos,
            'ingredientes_verificados': verificados,
            'ingredientes_no_verificados': no_verificados,
            'aditivos': aditivos,
            'posibles_duplicados_count': len(posibles_duplicados),
            'posibles_duplicados': posibles_duplicados,
            'ratio_ingredientes_por_alimento': total_ingredientes / max(total_alimentos, 1)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
