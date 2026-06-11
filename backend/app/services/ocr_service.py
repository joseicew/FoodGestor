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
            f'Comprueba que existe la clave en {os.path.abspath(_ENV_PATH)}'
        )
    return anthropic.Anthropic(api_key=api_key)


def _extraer_json(texto: str, tipo: str):
    """Extrae el primer bloque JSON del tipo indicado ('array' o 'object')."""
    if tipo == 'array':
        match = re.search(r'\[[\s\S]*\]', texto)
    else:
        match = re.search(r'\{[\s\S]*\}', texto)
    if match:
        return json.loads(match.group())
    return json.loads(texto)


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
                        'Lee el código de barras de esta imagen. '
                        'Devuelve SOLO los dígitos numéricos del código (EAN-13, UPC-A u otro), '
                        'sin espacios, sin guiones, sin texto adicional. '
                        'Solo el número. Si no hay código de barras visible, responde: ""'
                    )
                }
            ]
        }]
    )

    texto = message.content[0].text.strip()
    # Extrae solo dígitos si Claude añade texto extra
    solo_digitos = re.sub(r'[^\d]', '', texto)
    if not solo_digitos:
        raise ValueError('No se pudo detectar el código de barras en la imagen.')
    return solo_digitos


def procesar_macros(image_data: bytes, content_type: str) -> dict:
    # Validar que la imagen sea una tabla nutricional
    if not _validar_tipo_imagen(image_data, content_type, 'tabla_nutricional'):
        raise ValueError(
            'La imagen no parece contener una tabla de información nutricional. '
            'Por favor, sube una foto clara de la tabla de macronutrientes del producto.'
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
                        'Esta imagen muestra la tabla de información nutricional de un producto. '
                        'Extrae los valores por 100g y devuelve SOLO este JSON (sin explicaciones):\n'
                        '{\n'
                        '  "calorias": number,\n'
                        '  "proteinas": number,\n'
                        '  "hidratos_carbono": number,\n'
                        '  "azucares": number,\n'
                        '  "grasas": number,\n'
                        '  "grasas_saturadas": number,\n'
                        '  "fibra": number,\n'
                        '  "sal": number,\n'
                        '  "sodio": number\n'
                        '}\n'
                        'Si un valor no aparece en la imagen usa 0. Solo responde con el JSON.'
                    )
                }
            ]
        }]
    )

    return _extraer_json(message.content[0].text.strip(), 'object')


def procesar_datos_completos(image_data: bytes, content_type: str) -> dict:
    """
    Procesa una imagen de producto (etiqueta completa) y extrae:
    - nombre del producto
    - marca
    - código de barras (EAN)
    - ingredientes
    - macronutrientes
    """
    client = _cliente()
    image_b64 = base64.standard_b64encode(image_data).decode('utf-8')

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=2048,
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
                        'Analiza esta etiqueta de producto alimenticio y extrae TODOS estos datos:\n'
                        '{\n'
                        '  "nombre": "nombre del producto",\n'
                        '  "marca": "marca del producto",\n'
                        '  "codigo_barras": "números del EAN sin espacios",\n'
                        '  "ingredientes": ["ingrediente1", "ingrediente2", ...],\n'
                        '  "macros": {\n'
                        '    "calorias": número,\n'
                        '    "proteinas": número,\n'
                        '    "hidratos_carbono": número,\n'
                        '    "azucares": número,\n'
                        '    "grasas": número,\n'
                        '    "grasas_saturadas": número (opcional),\n'
                        '    "fibra": número (opcional),\n'
                        '    "sal": número (opcional)\n'
                        '  }\n'
                        '}\n'
                        'Instrucciones:\n'
                        '- Si hay múltiples idiomas en ingredientes, usa SOLO la versión en ESPAÑOL\n'
                        '- Los valores de macros deben ser por 100g\n'
                        '- Si un valor no aparece, usa null (no 0)\n'
                        '- El código de barras: solo números, sin espacios\n'
                        '- Responde SOLO con el JSON válido, sin explicaciones\n'
                    )
                }
            ]
        }]
    )

    try:
        datos = _extraer_json(message.content[0].text.strip(), 'object')
        return datos
    except Exception as e:
        raise ValueError(f'Error al procesar datos completos: {str(e)}')
