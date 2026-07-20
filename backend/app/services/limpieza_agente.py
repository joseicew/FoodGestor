"""
Agente de IA (Claude) que automatiza las limpiezas de la tabla `ingrediente`
que se hicieron manualmente durante la normalización de la base de datos:
asignar categorías/alérgenos faltantes, separar ingredientes compuestos,
simplificar descripciones que en realidad no son un ingrediente, y anotar
aditivos sin descripción.

Cada tipo de limpieza define sus candidatos, el prompt del agente y cómo
aplicar las acciones que devuelve. El agente solo propone acciones; la
seguridad (no perder avisos de alérgenos reales) se aplica siempre en código,
nunca se confía ciegamente en la respuesta del modelo.
"""

import os
import json
import anthropic
from dotenv import load_dotenv
from sqlalchemy import text
from app import db
from app.models.ingrediente import Ingrediente, ALERGENO_CATEGORIAS
from app.services.ingredientes_helper import obtener_o_crear_ingrediente

_ENV_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
)
load_dotenv(_ENV_PATH, override=True)

MODELO = 'claude-haiku-4-5-20251001'
LOTE_TAMANIO = 25
LIMITE_POR_EJECUCION = 150  # cap por ejecución: si sobran más, el admin repite la acción


def _cliente():
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError(
            'ANTHROPIC_API_KEY no encontrada. Configúrala en el .env del backend.'
        )
    return anthropic.Anthropic(api_key=api_key)


def _extraer_json_array(texto: str):
    texto = texto.strip()
    start = texto.find('[')
    if start == -1:
        raise ValueError('No se encontró un array JSON en la respuesta del agente')
    for i in range(start + 1, len(texto) + 1):
        candidato = texto[start:i]
        try:
            return json.loads(candidato)
        except json.JSONDecodeError:
            continue
    raise ValueError('No se pudo parsear el JSON devuelto por el agente')


def _en_lotes(lista, tamano):
    for i in range(0, len(lista), tamano):
        yield lista[i:i + tamano]


def _es_seguro_eliminar(ingrediente: Ingrediente):
    """
    Comprueba que borrar/dividir `ingrediente` no elimine silenciosamente un
    aviso de alergia real: si es el único portador de alguna de sus categorías
    de alérgeno en algún alimento donde aparece, no es seguro tocarlo sin más.
    """
    categorias_propias = set(ingrediente.get_alergenos_categorias())
    if not categorias_propias:
        return True, ''

    for alimento in ingrediente.alimentos:
        categorias_resto = set()
        for otro in alimento.ingredientes:
            if otro.id == ingrediente.id:
                continue
            categorias_resto.update(otro.get_alergenos_categorias())
        huerfanas = categorias_propias - categorias_resto
        if huerfanas:
            return False, f'único portador de {", ".join(sorted(huerfanas))} en "{alimento.nombre}"'

    return True, ''


def _buscar_o_crear_ingrediente(nombre: str) -> Ingrediente:
    return obtener_o_crear_ingrediente(nombre, verificado=False)


def _vincular_alimentos(origen: Ingrediente, destinos: list):
    """
    Vincula todos los alimentos de `origen` a cada ingrediente en `destinos`
    (evitando duplicados) y borra las filas de asociación de `origen`.
    No borra `origen` en sí: eso lo hace el llamador con SQL directo.
    """
    alimento_ids = [a.id for a in origen.alimentos]
    for alimento_id in alimento_ids:
        for destino in destinos:
            existe = db.session.execute(text(
                'SELECT 1 FROM alimento_ingrediente WHERE alimento_id=:aid AND ingrediente_id=:iid'
            ), {'aid': alimento_id, 'iid': destino.id}).first()
            if not existe:
                db.session.execute(text(
                    'INSERT INTO alimento_ingrediente (alimento_id, ingrediente_id) VALUES (:aid, :iid)'
                ), {'aid': alimento_id, 'iid': destino.id})
    db.session.execute(text(
        'DELETE FROM alimento_ingrediente WHERE ingrediente_id=:id'
    ), {'id': origen.id})


# ─────────────────────────── sin_categoria ───────────────────────────

def _query_sin_categoria():
    return Ingrediente.query.filter(db.or_(Ingrediente.categoria.is_(None), Ingrediente.categoria == ''))


def _item_sin_categoria(ing: Ingrediente):
    return {'id': ing.id, 'nombre': ing.nombre, 'es_aditivo': ing.es_aditivo, 'notas': ing.notas or ''}


def _aplicar_sin_categoria(ing: Ingrediente, accion: dict):
    categoria = accion.get('categoria')
    if not categoria or not isinstance(categoria, str):
        return {'resultado': 'omitido', 'motivo': 'El agente no devolvió una categoría válida'}
    ing.categoria = categoria.strip()[:100]
    return {'resultado': 'aplicado', 'detalle': f'Categoría asignada: {ing.categoria}'}


PROMPT_SIN_CATEGORIA = """Eres un asistente que clasifica ingredientes de alimentos por su categoría/grupo alimenticio, para una app de nutrición en español.

Para cada ingrediente recibido (id, nombre, es_aditivo, notas), asigna la categoría de alimento más adecuada. Usa una de estas si encaja bien, o una equivalente breve en español si ninguna encaja:
cereal, legumbre, fruta, verdura, fruto seco, carne, pescado, marisco, lácteo, huevo, grasa/aceite, edulcorante/azúcar, especia/condimento, bebida, vitamina/suplemento, aditivo, otro.

Si es un aditivo (código E, conservante, colorante, antioxidante, emulgente...) usa "aditivo".

Responde ÚNICAMENTE con un array JSON, sin texto adicional ni explicaciones, con una entrada por cada id recibido (no omitas ninguno), en este formato exacto:
[{"id": 123, "categoria": "fruta"}]"""


# ────────────────────────── alergenos_faltantes ──────────────────────────

def _query_alergenos_faltantes():
    return Ingrediente.query.filter(
        db.or_(Ingrediente.alergenos_categorias.is_(None), Ingrediente.alergenos_categorias == '[]')
    ).filter(
        db.or_(Ingrediente.nombre.ilike('%traza%'), Ingrediente.notas.ilike('%traza%'))
    )


def _item_alergenos_faltantes(ing: Ingrediente):
    return {'id': ing.id, 'nombre': ing.nombre, 'notas': ing.notas or ''}


def _aplicar_alergenos_faltantes(ing: Ingrediente, accion: dict):
    alergenos = accion.get('alergenos')
    if not isinstance(alergenos, list):
        return {'resultado': 'omitido', 'motivo': 'Formato de alérgenos inválido'}
    invalidos = [a for a in alergenos if a not in ALERGENO_CATEGORIAS]
    if invalidos:
        return {'resultado': 'omitido', 'motivo': f'Categorías no reconocidas: {invalidos}'}
    if not alergenos:
        return {'resultado': 'omitido', 'motivo': 'El agente no identificó ningún alérgeno con seguridad'}
    ing.set_alergenos_categorias(alergenos)
    return {'resultado': 'aplicado', 'detalle': f'Alérgenos asignados: {", ".join(alergenos)}'}


PROMPT_ALERGENOS_FALTANTES = f"""Eres un asistente que revisa ingredientes que mencionan "trazas de" un alérgeno y les asigna la(s) categoría(s) de alérgeno correctas, para una app de nutrición en español.

Categorías de alérgeno válidas (usa EXACTAMENTE estos nombres): {", ".join(ALERGENO_CATEGORIAS)}

Reglas de mapeo habituales: "trazas de frutos de cáscara/cacahuete" -> "Frutos secos"; "trazas de leche" -> "Lácteos"; "trazas de huevo" -> "Huevo"; "trazas de pescado" -> "Pescado"; "trazas de crustáceos/marisco" -> "Marisco"; "trazas de moluscos" -> "Moluscos"; "trazas de soja" -> "Soja"; "trazas de gluten/cereales con gluten" -> "Gluten"; "trazas de sésamo" -> "Sésamo"; "trazas de sulfitos/dióxido de azufre" -> "Sulfitos"; "trazas de mostaza" -> "Mostaza"; "trazas de altramuces/lupino" -> "Altramuces".

Si el ingrediente menciona varias trazas a la vez, incluye todas las categorías que apliquen. Si no puedes determinar ninguna con seguridad, devuelve un array vacío para ese id (nunca inventes).

Responde ÚNICAMENTE con un array JSON, una entrada por cada id recibido, en este formato exacto:
[{{"id": 123, "alergenos": ["Frutos secos"]}}]"""


# ─────────────────────── compuestos_descripciones ───────────────────────

def _query_compuestos_descripciones():
    return Ingrediente.query.filter(db.func.length(Ingrediente.nombre) > 45)


def _item_compuestos_descripciones(ing: Ingrediente):
    return {
        'id': ing.id,
        'nombre': ing.nombre,
        'usado_por_n_alimentos': len(ing.alimentos),
        'tiene_alergenos_asignados': bool(ing.get_alergenos_categorias()),
    }


def _aplicar_compuestos_descripciones(ing: Ingrediente, accion: dict):
    tipo_accion = accion.get('accion')

    if tipo_accion in (None, 'mantener'):
        return {'resultado': 'omitido', 'motivo': 'El agente decidió mantenerlo sin cambios'}

    if tipo_accion == 'renombrar':
        nuevo_nombre = (accion.get('nuevo_nombre') or '').strip()
        if not nuevo_nombre:
            return {'resultado': 'omitido', 'motivo': 'Nombre nuevo vacío'}
        existente = Ingrediente.query.filter(
            db.func.lower(Ingrediente.nombre) == nuevo_nombre.lower(), Ingrediente.id != ing.id
        ).first()
        if existente:
            _vincular_alimentos(ing, [existente])
            db.session.execute(text('DELETE FROM ingrediente WHERE id=:id'), {'id': ing.id})
            return {'resultado': 'aplicado', 'detalle': f'Fusionado con ingrediente existente "{existente.nombre}"'}
        ing.nombre = nuevo_nombre[:255]
        return {'resultado': 'aplicado', 'detalle': f'Renombrado a "{nuevo_nombre}"'}

    if tipo_accion == 'eliminar':
        seguro, motivo = _es_seguro_eliminar(ing)
        if not seguro:
            return {'resultado': 'omitido', 'motivo': f'No es seguro eliminar: {motivo}'}
        db.session.execute(text('DELETE FROM alimento_ingrediente WHERE ingrediente_id=:id'), {'id': ing.id})
        db.session.execute(text('DELETE FROM ingrediente WHERE id=:id'), {'id': ing.id})
        return {'resultado': 'aplicado', 'detalle': 'Eliminado (no era un ingrediente real)'}

    if tipo_accion == 'dividir':
        nuevos_nombres = accion.get('nuevos_nombres')
        if not isinstance(nuevos_nombres, list) or not nuevos_nombres:
            return {'resultado': 'omitido', 'motivo': 'Lista de nuevos ingredientes vacía o inválida'}
        seguro, motivo = _es_seguro_eliminar(ing)
        if not seguro:
            return {'resultado': 'omitido', 'motivo': f'No es seguro dividir el original: {motivo}'}
        destinos = [_buscar_o_crear_ingrediente(n) for n in nuevos_nombres if isinstance(n, str) and n.strip()]
        if not destinos:
            return {'resultado': 'omitido', 'motivo': 'Ningún nombre válido en la división'}
        _vincular_alimentos(ing, destinos)
        db.session.execute(text('DELETE FROM ingrediente WHERE id=:id'), {'id': ing.id})
        return {'resultado': 'aplicado', 'detalle': f'Dividido en: {", ".join(d.nombre for d in destinos)}'}

    return {'resultado': 'omitido', 'motivo': f'Acción desconocida del agente: {tipo_accion}'}


PROMPT_COMPUESTOS_DESCRIPCIONES = """Eres un asistente que limpia la tabla "ingrediente" de una app de nutrición. Muchos ingredientes se crearon copiando listas de ingredientes completas de productos reales en vez de nombres de ingredientes individuales.

Para cada ingrediente con nombre sospechosamente largo, decide UNA de estas 4 acciones:

1. "mantener": el nombre es largo pero es un ingrediente real y específico tal cual (ej. "Aceite de oliva virgen extra"). No lo toques.
2. "renombrar": el texto describe UN solo ingrediente con paja de marketing o palabras de sobra (ej. "Chocolate con leche de cobertura con edulcorante" -> "Chocolate con leche"). Da el nuevo nombre corto y correcto.
3. "dividir": el texto concatena VARIOS ingredientes distintos (una lista de ingredientes pegada como si fuera uno solo). Sepáralos en una lista de nombres de ingredientes individuales ya normalizados.
4. "eliminar": el texto es solo una descripción o frase que no aporta ningún ingrediente real. Bórralo.

Reglas importantes:
- Nunca inventes ingredientes que no estén mencionados en el texto original.
- Si dudas entre "renombrar" y "mantener", prefiere "mantener".
- Si dudas entre "eliminar" y "dividir", prefiere "dividir" (más seguro no perder información).
- Si "usado_por_n_alimentos" es alto o "tiene_alergenos_asignados" es true, sé especialmente conservador.

Responde ÚNICAMENTE con un array JSON, una entrada por cada id recibido, usando uno de estos 4 formatos exactos:
{"id": 1, "accion": "mantener"}
{"id": 2, "accion": "renombrar", "nuevo_nombre": "Chocolate con leche"}
{"id": 3, "accion": "dividir", "nuevos_nombres": ["Proteínas de la leche", "Edulcorante maltitol", "Chocolate con leche"]}
{"id": 4, "accion": "eliminar"}"""


# ────────────────────────── aditivos_sin_nota ──────────────────────────

def _query_aditivos_sin_nota():
    return Ingrediente.query.filter(Ingrediente.es_aditivo.is_(True)).filter(
        db.or_(Ingrediente.notas.is_(None), Ingrediente.notas == '')
    )


def _item_aditivos_sin_nota(ing: Ingrediente):
    return {'id': ing.id, 'nombre': ing.nombre}


def _aplicar_aditivos_sin_nota(ing: Ingrediente, accion: dict):
    nota = (accion.get('nota') or '').strip()
    if not nota:
        return {'resultado': 'omitido', 'motivo': 'El agente no reconoció el aditivo con seguridad'}
    ing.notas = nota[:1000]
    return {'resultado': 'aplicado', 'detalle': 'Nota añadida'}


PROMPT_ADITIVOS_SIN_NOTA = """Eres un asistente que documenta aditivos alimentarios (colorantes, conservantes, antioxidantes, emulgentes, etc., normalmente códigos E) para una app de nutrición en español.

Para cada aditivo recibido (nombre, que puede ser un código E o un nombre técnico), escribe una nota breve (máximo 140 caracteres) en español explicando qué es y para qué se usa. Si no lo reconoces con seguridad, devuelve nota vacía "".

Responde ÚNICAMENTE con un array JSON, una entrada por cada id recibido, en este formato exacto:
[{"id": 1, "nota": "Colorante amarillo usado en bebidas y snacks; en dosis altas se asocia a hiperactividad infantil."}]"""


TIPOS_LIMPIEZA = {
    'sin_categoria': {
        'nombre': 'Ingredientes sin categoría',
        'descripcion': 'El agente asigna una categoría de alimento (fruta, lácteo, aditivo...) a los ingredientes que no tienen ninguna.',
        'query': _query_sin_categoria,
        'construir_item': _item_sin_categoria,
        'prompt_sistema': PROMPT_SIN_CATEGORIA,
        'aplicar': _aplicar_sin_categoria,
    },
    'alergenos_faltantes': {
        'nombre': 'Trazas sin alérgeno asignado',
        'descripcion': 'El agente detecta menciones de "trazas de X" sin categoría de alérgeno y asigna la categoría correcta.',
        'query': _query_alergenos_faltantes,
        'construir_item': _item_alergenos_faltantes,
        'prompt_sistema': PROMPT_ALERGENOS_FALTANTES,
        'aplicar': _aplicar_alergenos_faltantes,
    },
    'compuestos_descripciones': {
        'nombre': 'Nombres largos, compuestos o descripciones',
        'descripcion': 'El agente revisa ingredientes con nombres muy largos y decide: mantener, renombrar, dividir en varios ingredientes reales, o eliminar si no es un ingrediente.',
        'query': _query_compuestos_descripciones,
        'construir_item': _item_compuestos_descripciones,
        'prompt_sistema': PROMPT_COMPUESTOS_DESCRIPCIONES,
        'aplicar': _aplicar_compuestos_descripciones,
    },
    'aditivos_sin_nota': {
        'nombre': 'Aditivos sin descripción',
        'descripcion': 'El agente añade una nota explicando qué es cada aditivo (código E) que no tiene descripción.',
        'query': _query_aditivos_sin_nota,
        'construir_item': _item_aditivos_sin_nota,
        'prompt_sistema': PROMPT_ADITIVOS_SIN_NOTA,
        'aplicar': _aplicar_aditivos_sin_nota,
    },
}


def ejecutar_limpieza(tipo: str) -> dict:
    config = TIPOS_LIMPIEZA.get(tipo)
    if not config:
        raise ValueError(f'Tipo de limpieza desconocido: {tipo}')

    candidatos = config['query']().limit(LIMITE_POR_EJECUCION).all()
    total_candidatos = len(candidatos)

    if total_candidatos == 0:
        return {
            'tipo': tipo,
            'nombre': config['nombre'],
            'total_candidatos': 0,
            'acciones': [],
            'resumen': {'aplicados': 0, 'omitidos': 0, 'errores': 0},
            'mensaje': 'No hay ingredientes pendientes para esta limpieza ahora mismo.'
        }

    cliente = _cliente()
    acciones_reporte = []

    for lote in _en_lotes(candidatos, LOTE_TAMANIO):
        ids_lote = [ing.id for ing in lote]
        nombres_lote = {ing.id: ing.nombre for ing in lote}
        items = [config['construir_item'](ing) for ing in lote]

        prompt_usuario = (
            'Estos son los ingredientes a revisar (JSON):\n\n' +
            json.dumps(items, ensure_ascii=False, indent=2) +
            '\n\nResponde con el array JSON de acciones, una por cada id, sin texto adicional.'
        )

        try:
            mensaje = cliente.messages.create(
                model=MODELO,
                max_tokens=4096,
                system=config['prompt_sistema'],
                messages=[{'role': 'user', 'content': prompt_usuario}]
            )
            texto = mensaje.content[0].text
            acciones = _extraer_json_array(texto)
            acciones_por_id = {a.get('id'): a for a in acciones if isinstance(a, dict) and 'id' in a}
        except Exception as e:
            for ing_id in ids_lote:
                acciones_reporte.append({
                    'id': ing_id, 'nombre': nombres_lote[ing_id], 'resultado': 'error',
                    'motivo': f'Fallo al llamar al agente: {e}'
                })
            continue

        for ing in lote:
            accion = acciones_por_id.get(ing.id)
            if not accion:
                acciones_reporte.append({
                    'id': ing.id, 'nombre': ing.nombre, 'resultado': 'omitido',
                    'motivo': 'El agente no devolvió una acción para este ingrediente'
                })
                continue
            try:
                nombre_original = ing.nombre
                resultado = config['aplicar'](ing, accion)
                db.session.commit()
                acciones_reporte.append({
                    'id': ing.id,
                    'nombre': nombre_original,
                    'resultado': resultado.get('resultado', 'aplicado'),
                    'detalle': resultado.get('detalle', ''),
                    'motivo': resultado.get('motivo', ''),
                })
            except Exception as e:
                db.session.rollback()
                acciones_reporte.append({
                    'id': ing.id, 'nombre': ing.nombre, 'resultado': 'error', 'motivo': str(e)
                })

    resumen = {
        'aplicados': sum(1 for a in acciones_reporte if a['resultado'] == 'aplicado'),
        'omitidos': sum(1 for a in acciones_reporte if a['resultado'] == 'omitido'),
        'errores': sum(1 for a in acciones_reporte if a['resultado'] == 'error'),
    }

    return {
        'tipo': tipo,
        'nombre': config['nombre'],
        'total_candidatos': total_candidatos,
        'acciones': acciones_reporte,
        'resumen': resumen,
    }
