import anthropic
import base64
import json
import os
import re
from dotenv import load_dotenv

# Carga el .env usando la ruta absoluta del fichero, sin depender del cwd
_ENV_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
)
load_dotenv(_ENV_PATH, override=True)


def _cliente():
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise RuntimeError(
            'ANTHROPIC_API_KEY no encontrada. '
            'Configura la variable de entorno ANTHROPIC_API_KEY con tu clave de API de Anthropic. '
            f'En desarrollo local, agrégala a {os.path.abspath(_ENV_PATH)}. '
            f'En Railway, configúrala en el dashboard de variables de entorno.'
        )
    return anthropic.Anthropic(api_key=api_key)


def _extraer_json(texto: str, tipo: str):
    """Extrae el primer bloque JSON del tipo indicado ('array' o 'object')."""
    texto = texto.strip()

    if tipo == 'array':
        # Buscar el primer [ y el último ]
        start = texto.find('[')
        if start == -1:
            raise ValueError('No se encontró array JSON en la respuesta')
        # Encontrar el ] más cercano que cierre correctamente el JSON
        try:
            for i in range(start + 1, len(texto) + 1):
                candidate = texto[start:i]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
        except:
            pass
    else:
        # Buscar el primer { y el último }
        start = texto.find('{')
        if start == -1:
            raise ValueError('No se encontró objeto JSON en la respuesta')
        # Encontrar el } más cercano que cierre correctamente el JSON
        try:
            for i in range(start + 1, len(texto) + 1):
                candidate = texto[start:i]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
        except:
            pass

    # Último intento: parsear directamente
    try:
        return json.loads(texto)
    except json.JSONDecodeError as e:
        raise ValueError(f'No se pudo extraer JSON válido de la respuesta: {str(e)}')


def _validar_tipo_imagen(image_data: bytes, content_type: str, tipo_esperado: str) -> bool:
    """
    Valida que la imagen sea del tipo esperado (tabla_nutricional, ingredientes, codigo_barras).
    Retorna True si es válida, False si no lo es.
    """
    client = _cliente()
    image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

    prompts = {
        'tabla_nutricional': (
            'Mira esta imagen. ¿Contiene una tabla de información nutricional (macronutrientes, calorías, proteínas, etc.)? '
            'Responde SOLO "sí" o "no".'
        ),
        'ingredientes': (
            'Mira esta imagen. ¿Contiene una lista de ingredientes de un producto alimenticio? '
            'Responde SOLO "sí" o "no".'
        ),
        'codigo_barras': (
            'Mira esta imagen. ¿Contiene un código de barras o código EAN visible? '
            'Responde SOLO "sí" o "no".'
        )
    }

    prompt = prompts.get(tipo_esperado)
    if not prompt:
        return True  # Si tipo desconocido, aceptar

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=10,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': content_type,
                        'data': image_b64
                    }
                },
                {
                    'type': 'text',
                    'text': prompt
                }
            ]
        }]
    )

    respuesta = message.content[0].text.strip().lower()
    return 'sí' in respuesta or 'si' in respuesta or 'yes' in respuesta


def procesar_ingredientes(image_data: bytes, content_type: str) -> list[str]:
    # Validar que la imagen sea una lista de ingredientes
    if not _validar_tipo_imagen(image_data, content_type, 'ingredientes'):
        raise ValueError(
            'La imagen no parece contener una lista de ingredientes. '
            'Por favor, sube una foto de la lista de ingredientes del producto.'
        )

    client = _cliente()
    image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=1024,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': content_type,
                        'data': image_b64
                    }
                },
                {
                    'type': 'text',
                    'text': (
                        'Esta imagen contiene la lista de ingredientes de un producto alimenticio. '
                        'Si hay múltiples idiomas, extrae SOLO los ingredientes de la sección en ESPAÑOL (marcada con "ES" o "INGREDIENTES"). '
                        'Ignora completamente cualquier sección en otros idiomas. '
                        'Devuelve SOLO un array JSON con los nombres en español. '
                        'Sin explicaciones, solo el JSON. Ejemplo: ["harina de trigo", "azúcar", "sal"]'
                    )
                }
            ]
        }]
    )

    return _extraer_json(message.content[0].text.strip(), 'array')


def procesar_codigo_barras(image_data: bytes, content_type: str) -> str:
    # Validar que la imagen sea un código de barras
    if not _validar_tipo_imagen(image_data, content_type, 'codigo_barras'):
        raise ValueError(
            'La imagen no parece contener un código de barras. '
            'Por favor, sube una foto clara del código de barras del producto.'
        )

    client = _cliente()
    image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=64,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': content_type,
                        'data': image_b64
                    }
                },
                {
                    'type': 'text',
                    'text': (
                        'Lee SOLO el código de barras visible en la imagen. '
                        'El código de barras es una secuencia larga de números (típicamente 12-15 dígitos). '
                        'Devuelve SOLO esos dígitos, sin espacios, sin guiones, sin texto. '
                        'Si no hay un código de barras claro y legible, responde: ""'
                    )
                }
            ]
        }]
    )

    texto = message.content[0].text.strip()
    # Extrae solo dígitos si Claude añade texto extra
    solo_digitos = re.sub(r'[^\d]', '', texto)

    # Validar que sea una longitud válida de código de barras
    # EAN-13: 13 dígitos, EAN-12: 12 dígitos, UPC-A: 12 dígitos, etc.
    if not solo_digitos or len(solo_digitos) < 8 or len(solo_digitos) > 15:
        raise ValueError(
            f'Código de barras inválido o no detectado. '
            f'Se esperaba 8-15 dígitos, se obtuvo: {len(solo_digitos)} dígitos'
        )

    return solo_digitos


def procesar_macros(image_data: bytes, content_type: str) -> dict:
    # NO validar tipo para ser más permisivo
    # if not _validar_tipo_imagen(image_data, content_type, 'tabla_nutricional'):
    #     raise ValueError(...)

    client = _cliente()
    image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=1024,
        messages=[{
            'role': 'user',
            'content': [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': content_type,
                        'data': image_b64
                    }
                },
                {
                    'type': 'text',
                    'text': (
                        'EXTRAE LA TABLA NUTRICIONAL de esta imagen.\n'
                        'Lee TODOS los valores por 100g (o 100ml si es bebida).\n'
                        'Devuelve EXACTAMENTE este JSON:\n'
                        '{\n'
                        '  "calorias": número,\n'
                        '  "proteinas": número,\n'
                        '  "hidratos_carbono": número,\n'
                        '  "azucares": número,\n'
                        '  "grasas": número,\n'
                        '  "grasas_saturadas": número,\n'
                        '  "fibra": número,\n'
                        '  "sal": número,\n'
                        '  "sodio": número\n'
                        '}\n'
                        'Reglas:\n'
                        '- Lee valores EXACTOS de la tabla visible\n'
                        '- Si no ves un valor, usa null\n'
                        '- Para energia en kJ, convierte a kcal: kcal = kJ / 4.184\n'
                        '- SOLO JSON, sin texto adicional\n'
                    )
                }
            ]
        }]
    )

    return _extraer_json(message.content[0].text.strip(), 'object')


def procesar_datos_completos(image_data: bytes, content_type: str) -> dict:
    """
    Procesa una imagen de producto y extrae TODOS los datos usando:
    - procesar_codigo_barras() para el código EAN
    - procesar_ingredientes() para la lista de ingredientes
    - procesar_macros() para los macronutrientes
    - Claude API para nombre, marca, categoría
    """
    import concurrent.futures

    resultado = {
        'nombre': None,
        'marca': None,
        'categoria': None,
        'codigo_barras': None,
        'ingredientes': None,
        'macros': None
    }

    # Función para extraer datos generales (nombre, marca, categoria)
    def _extraer_datos_generales():
        try:
            client = _cliente()
            image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

            message = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=256,
                messages=[{
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': content_type,
                                'data': image_b64
                            }
                        },
                        {
                            'type': 'text',
                            'text': (
                                'Extrae estos datos del producto:\n'
                                '{\n'
                                '  "nombre": "nombre exacto del producto o null",\n'
                                '  "marca": "marca del producto o null",\n'
                                '  "categoria": "categoría (ej: Arroz, Bebidas, Lácteos) o null"\n'
                                '}\n'
                                'SOLO JSON, sin explicaciones.'
                            )
                        }
                    ]
                }]
            )

            datos = _extraer_json(message.content[0].text.strip(), 'object')
            return datos
        except Exception:
            return {}

    # Usar ThreadPoolExecutor para ejecutar en paralelo
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        # Lanzar todas las tareas en paralelo
        future_generales = executor.submit(_extraer_datos_generales)
        future_codigo = executor.submit(procesar_codigo_barras, image_data, content_type)
        future_ingredientes = executor.submit(procesar_ingredientes, image_data, content_type)
        future_macros = executor.submit(procesar_macros, image_data, content_type)

        # Recopilar resultados
        try:
            datos_generales = future_generales.result()
            if datos_generales:
                resultado['nombre'] = datos_generales.get('nombre')
                resultado['marca'] = datos_generales.get('marca')
                resultado['categoria'] = datos_generales.get('categoria')
        except Exception:
            pass

        try:
            codigo = future_codigo.result()
            if codigo:
                resultado['codigo_barras'] = codigo
        except Exception:
            pass

        try:
            ingredientes = future_ingredientes.result()
            if ingredientes:
                resultado['ingredientes'] = ingredientes
        except Exception:
            pass

        try:
            macros = future_macros.result()
            if macros:
                resultado['macros'] = macros
        except Exception:
            pass

    return resultado
