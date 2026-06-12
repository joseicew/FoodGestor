#!/usr/bin/env python3
"""
Script para reintentar productos que fallaron en scraping anterior
"""
import os
import sys
import requests
import time
import random
import json
from datetime import datetime

from dotenv import load_dotenv
import re
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
load_dotenv(env_path)

def limpiar_html(texto):
    """Limpia tags HTML del texto."""
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = texto.replace('&aacute;', 'á').replace('&eacute;', 'é').replace('&iacute;', 'í')
    texto = texto.replace('&oacute;', 'ó').replace('&uacute;', 'ú').replace('&ntilde;', 'ñ')
    texto = texto.strip()
    return texto

def procesar_ingredientes(texto):
    """Procesa lista de ingredientes con separadores inteligentes.

    Maneja:
    - Divisiones por comas, puntos, "y"
    - Paréntesis con compuestos (colorantes, estabilizantes, etc.)
    - Paréntesis con información adicional (porcentajes, cantidades)
    """
    if not texto:
        return []

    # Palabras clave que indican categorías de compuestos
    categorias_compuestos = {
        'colorante', 'colorantes',
        'estabilizante', 'estabilizantes',
        'conservante', 'conservantes',
        'edulcorante', 'edulcorantes',
        'emulsionante', 'emulsionantes',
        'antioxidante', 'antioxidantes',
        'acidulante', 'acidulantes',
        'aroma', 'aromas', 'aromatizante', 'aromatizantes',
        'espesante', 'espesantes',
        'regulador', 'reguladores',
        'gelificante', 'gelificantes',
        'vitaminas', 'vitamina'
    }

    # Procesar paréntesis anidados recursivamente
    def limpiar_parentesis_anidados(txt):
        """Remueve paréntesis anidados manteniendo solo nivel 1."""
        # Remover paréntesis anidados (dentro de paréntesis)
        while '(' in txt and ')' in txt:
            # Buscar el paréntesis más interno y remover su contenido
            txt_new = re.sub(r'\([^()]*\)', lambda m: '', txt)
            if txt_new == txt:
                break
            txt = txt_new
        return txt

    # Primero, simplificar paréntesis anidados dentro de categorías
    # Ej: "vitaminas (acetato de retinilo (vitamina A), ...)" -> "vitaminas (acetato de retinilo, ...)"
    texto = re.sub(r'(\w+)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)',
                   lambda m: f"{m.group(1)} ({limpiar_parentesis_anidados(m.group(2))})",
                   texto)

    def procesar_parentesis_simple(match):
        """Procesa paréntesis de nivel único."""
        base = match.group(1).strip()
        contenido = match.group(2).strip()

        # Obtener la palabra clave (último sustantivo antes del paréntesis)
        palabras_base = base.lower().split()
        palabra_clave = palabras_base[-1] if palabras_base else ''

        # Si la palabra clave indica una categoría de compuestos
        if palabra_clave in categorias_compuestos:
            # Extraer solo los compuestos del paréntesis
            compuestos = [c.strip() for c in contenido.split(',')]
            # Retornar como "E-407, E-451" etc (sin "Estabilizantes")
            return ', '.join(compuestos)

        # Si contiene códigos E-xxx u otros aditivos
        if re.search(r'E-?\d{3,4}', contenido):
            compuestos = [c.strip() for c in contenido.split(',')]
            return ', '.join(compuestos)

        # Si no, es información adicional (porcentaje, cantidad, origen) -> eliminar
        return base

    # Reemplazar paréntesis de nivel único
    texto = re.sub(r'([^()]+)\(([^()]*)\)', procesar_parentesis_simple, texto)

    # Dividir por separadores: comas, puntos, "y"
    texto = texto.replace('. ', ',')
    texto = re.sub(r'\s+y\s+', ',', texto, flags=re.IGNORECASE)

    # Dividir y limpiar
    ingredientes = [
        i.strip() for i in texto.split(',')
        if i.strip() and len(i.strip()) > 2
    ]

    return ingredientes

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento
from app.services.ocr_service import procesar_datos_completos

app = create_app()

MERCADONA_API = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"
DELAY_SEGUNDOS = 3

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

def obtener_user_agent():
    return random.choice(USER_AGENTS)

def esperar():
    delay = DELAY_SEGUNDOS + random.uniform(1, 3)
    print(f"    [WAIT] {delay:.1f}s...", end='', flush=True)
    time.sleep(delay)
    print(" OK")

def descargar_imagen(url):
    try:
        headers = {'User-Agent': obtener_user_agent()}
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        return response.content
    except:
        return None

def obtener_datos_producto(product_id):
    try:
        headers = {'User-Agent': obtener_user_agent()}
        url = MERCADONA_API.format(id=product_id)
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        data = response.json()
        nombre = data.get('slug', '').replace('-', ' ').title()
        marca = data.get('brand', 'Sin marca')
        ean = data.get('ean', '')
        imagen_urls = []
        photos = data.get('photos', [])
        if photos and len(photos) > 1:
            imagen_urls.append(photos[1].get('regular', ''))
        if photos and len(photos) > 0:
            imagen_urls.append(photos[0].get('regular', ''))
        return {'id': product_id, 'nombre': nombre, 'marca': marca, 'ean': ean, 'imagen_urls': imagen_urls, 'datos_completos': data}
    except:
        return None

def producto_ya_existe(ean):
    if not ean:
        return False
    try:
        with app.app_context():
            existe = Alimento.query.filter_by(codigo_barras=ean).first()
            return existe is not None
    except:
        return False

def limpiar_nombre_producto(nombre, marca):
    """Elimina la marca del nombre si está incluida para evitar redundancia."""
    if not nombre or marca == 'Sin marca':
        return nombre

    # Remover marca del nombre (case-insensitive)
    nombre_limpio = nombre
    palabras_marca = marca.split()
    for palabra in palabras_marca:
        # Usar regex para remover palabra de manera case-insensitive
        nombre_limpio = re.sub(rf'\b{re.escape(palabra)}\b', '', nombre_limpio, flags=re.IGNORECASE)

    # Limpiar espacios extras
    nombre_limpio = ' '.join(nombre_limpio.split()).strip()
    return nombre_limpio if nombre_limpio else nombre

def procesar_producto(datos_api):
    nombre = datos_api.get('nombre', 'N/A')
    print(f"  [PROC] {nombre[:40]}")
    datos_completos = datos_api.get('datos_completos', {})
    display_name = datos_completos.get('display_name', datos_api.get('nombre', 'Sin nombre'))
    marca = datos_api.get('marca', 'Sin marca')

    # Limpiar nombre removiendo la marca
    display_name = limpiar_nombre_producto(display_name, marca)
    ean = datos_api.get('ean', '')
    ingredientes = []
    nutrition_info = datos_completos.get('nutrition_information', {})
    if isinstance(nutrition_info, dict):
        ingredients_text = nutrition_info.get('ingredients', '')
        if ingredients_text:
            ingredients_text = limpiar_html(ingredients_text)
            # Procesar con lógica inteligente de separadores
            ingredientes = procesar_ingredientes(ingredients_text)
    imagen_urls = datos_api.get('imagen_urls', [])
    macros = None
    if imagen_urls:
        for idx, imagen_url in enumerate(imagen_urls, 1):
            try:
                print(f"    Descargando imagen [{idx}/{len(imagen_urls)}]...")
                img_data = descargar_imagen(imagen_url)
                if not img_data:
                    print(f"    [SKIP] No se pudo descargar imagen {idx}")
                    continue
                print(f"    Extrayendo macros con OCR...")
                resultado_ocr = procesar_datos_completos(img_data, 'image/jpeg')
                if resultado_ocr:
                    macros_temp = resultado_ocr.get('macros', {})
                    kcal = macros_temp.get('calorias')
                    prot = macros_temp.get('proteinas')
                    grasas = macros_temp.get('grasas')
                    carbs = macros_temp.get('hidratos_carbono')
                    if kcal and prot is not None and grasas is not None and carbs is not None:
                        print(f"    [OK] Macros: {kcal}kcal")
                        macros = macros_temp
                        break
            except Exception as e:
                print(f"    [SKIP] Imagen {idx}: {e}")
                continue
    if not macros:
        print(f"    [FALLBACK] API...")
        if isinstance(nutrition_info, dict):
            kcal = nutrition_info.get('energy') or nutrition_info.get('kcal') or nutrition_info.get('calories')
            prot = nutrition_info.get('protein') or nutrition_info.get('proteins')
            grasas = nutrition_info.get('fat') or nutrition_info.get('fats')
            carbs = nutrition_info.get('carbohydrate') or nutrition_info.get('carbohydrates')
            if kcal and prot is not None and grasas is not None and carbs is not None:
                print(f"    [OK] API: {kcal}kcal")
                macros = {
                    'calorias': kcal,
                    'proteinas': prot,
                    'grasas': grasas,
                    'hidratos_carbono': carbs,
                    'azucares': nutrition_info.get('sugar'),
                    'fibra': nutrition_info.get('fiber'),
                    'sal': nutrition_info.get('sodium') or nutrition_info.get('salt'),
                }
    if macros:
        print(f"    [SAVE] {display_name[:40]}")
        return {'nombre': display_name, 'marca': marca, 'ean': ean, 'ingredientes': ingredientes, 'macros': macros}
    return None

def guardar_en_bd(datos):
    try:
        with app.app_context():
            from app.models import Ingrediente

            marca = datos.get('marca') or 'Sin marca'
            alimento = Alimento(
                nombre=datos.get('nombre'),
                marca=marca,
                codigo_barras=datos.get('ean'),
                categoria='Otros',
                calorias=datos.get('macros', {}).get('calorias'),
                proteinas=datos.get('macros', {}).get('proteinas'),
                grasas=datos.get('macros', {}).get('grasas'),
                grasas_saturadas=datos.get('macros', {}).get('grasas_saturadas'),
                hidratos_carbono=datos.get('macros', {}).get('hidratos_carbono'),
                azucares=datos.get('macros', {}).get('azucares'),
                fibra=datos.get('macros', {}).get('fibra'),
                sal=datos.get('macros', {}).get('sal'),
            )

            # Guardar ingredientes
            ingredientes = datos.get('ingredientes', [])
            for ing_nombre in ingredientes:
                if ing_nombre.strip():
                    ingrediente = Ingrediente.query.filter_by(nombre=ing_nombre.strip()).first()
                    if not ingrediente:
                        ingrediente = Ingrediente(nombre=ing_nombre.strip())
                        db.session.add(ingrediente)
                        db.session.flush()
                    alimento.ingredientes.append(ingrediente)

            db.session.add(alimento)
            db.session.commit()
            return alimento
    except Exception as e:
        print(f"      [ERROR] BD: {e}")
        return None

# Cargar fallos
print("=" * 60)
print("[INICIO] Reintentando productos que fallaron")
print("=" * 60)

try:
    with open('scrape_fallos.json', 'r') as f:
        fallos_data = json.load(f)
    fallos = fallos_data.get('fallos', [])
except:
    print("[ERROR] No se encontró scrape_fallos.json")
    sys.exit(1)

print(f"[INFO] {len(fallos)} productos para reintentar\n")

exitosos = []
nuevos_fallos = {'fallos': []}

for i, fallo in enumerate(fallos, 1):
    product_id = fallo['product_id']
    nombre_original = fallo['nombre']
    motivo_original = fallo['motivo']

    print(f"[{i}/{len(fallos)}]", end=" ")

    # Obtener datos
    datos_api = obtener_datos_producto(product_id)
    if not datos_api:
        print(f"[FAIL] API error")
        nuevos_fallos['fallos'].append({
            'product_id': product_id,
            'nombre': nombre_original,
            'motivo': 'Reintento: API error',
            'timestamp': datetime.now().isoformat()
        })
        esperar()
        continue

    if datos_api.get('ean') and producto_ya_existe(datos_api['ean']):
        print(f"[SKIP] Ya existe en BD")
        esperar()
        continue

    # Procesar
    datos = procesar_producto(datos_api)

    if datos:
        # Guardar
        alimento = guardar_en_bd(datos)
        if alimento:
            print(f"[OK] Guardado exitosamente")
            exitosos.append(datos['nombre'])
        else:
            print(f"[FAIL] Error al guardar")
            nuevos_fallos['fallos'].append({
                'product_id': product_id,
                'nombre': nombre_original,
                'motivo': 'Reintento: Error BD',
                'timestamp': datetime.now().isoformat()
            })
    else:
        print(f"[FAIL] Sin macros")
        nuevos_fallos['fallos'].append({
            'product_id': product_id,
            'nombre': nombre_original,
            'motivo': 'Reintento: Sin macros',
            'timestamp': datetime.now().isoformat()
        })

    esperar()

print("\n" + "=" * 60)
print("[RESUMEN]")
print("=" * 60)
print(f"Total a reintentar: {len(fallos)}")
print(f"Exitosos: {len(exitosos)}")
print(f"Aun fallos: {len(nuevos_fallos['fallos'])}")
print("=" * 60)

if exitosos:
    print("\n[GUARDADOS]")
    for producto in exitosos:
        print(f"  - {producto}")

if nuevos_fallos['fallos']:
    print(f"\n[NUEVOS FALLOS] Guardados en scrape_fallos.json")
    with open('scrape_fallos.json', 'w') as f:
        json.dump(nuevos_fallos, f, indent=2)
else:
    # Borrar archivo de fallos si no hay más fallos
    if os.path.exists('scrape_fallos.json'):
        os.remove('scrape_fallos.json')
    print("\n[OK] Todos los intentos exitosos. Archivo de fallos borrado.")
