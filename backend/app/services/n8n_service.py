import requests
import os
from dotenv import load_dotenv

# Carga el .env
_ENV_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env')
)
load_dotenv(_ENV_PATH, override=True)


def procesar_ingrediente_n8n(nombre_ingrediente: str) -> dict:
    """
    Envía el nombre del ingrediente a n8n para procesamiento automático.
    n8n busca en bases de datos y rellena información del ingrediente.

    Retorna un diccionario con los datos procesados:
    {
        'nombre': str,
        'descripcion': str,
        'alergias': str (CSV o JSON),
        'intolerancias': str (CSV o JSON),
        'tipo': str ('cereal', 'legumbre', 'fruta', 'verdura', 'fruto seco', etc),
        'origen': str,
        'organico': bool,
        'notas': str (anotaciones adicionales),
        'fuente_datos': 'n8n'
    }
    """
    webhook_url = os.getenv('N8N_WEBHOOK_INGREDIENTES')

    if not webhook_url or webhook_url.startswith('https://tu-n8n'):
        # Si no está configurado, crear ingrediente con valores por defecto
        return {
            'nombre': nombre_ingrediente,
            'descripcion': '',
            'alergias': '',
            'intolerancias': '',
            'tipo': '',
            'origen': '',
            'organico': False,
            'notas': '',
            'fuente_datos': 'manual'
        }

    try:
        # Enviar solicitud al webhook de n8n
        payload = {
            'nombre': nombre_ingrediente
        }

        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10  # timeout de 10 segundos
        )

        # Si n8n responde correctamente, usar sus datos
        if response.status_code == 200:
            data = response.json()
            return {
                'nombre': data.get('nombre', nombre_ingrediente),
                'descripcion': data.get('descripcion', ''),
                'alergias': data.get('alergias', ''),
                'intolerancias': data.get('intolerancias', ''),
                'tipo': data.get('tipo', ''),
                'origen': data.get('origen', ''),
                'organico': data.get('organico', False),
                'notas': data.get('notas', ''),
                'fuente_datos': 'n8n'
            }
        else:
            # Si hay error en n8n, usar valores por defecto
            print(f'Error en n8n webhook: {response.status_code} - {response.text}')
            return {
                'nombre': nombre_ingrediente,
                'descripcion': '',
                'alergias': '',
                'intolerancias': '',
                'tipo': '',
                'origen': '',
                'organico': False,
                'fuente_datos': 'manual'
            }

    except requests.exceptions.Timeout:
        print(f'Timeout al conectar con n8n para: {nombre_ingrediente}')
        return {
            'nombre': nombre_ingrediente,
            'descripcion': '',
            'alergias': '',
            'intolerancias': '',
            'tipo': '',
            'origen': '',
            'organico': False,
            'notas': '',
            'fuente_datos': 'manual'
        }
    except Exception as e:
        print(f'Error al procesar ingrediente en n8n: {str(e)}')
        return {
            'nombre': nombre_ingrediente,
            'descripcion': '',
            'alergias': '',
            'intolerancias': '',
            'tipo': '',
            'origen': '',
            'organico': False,
            'notas': '',
            'fuente_datos': 'manual'
        }
