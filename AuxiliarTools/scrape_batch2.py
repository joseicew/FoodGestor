#!/usr/bin/env python3
"""
Scraper para lote 2 (productos 20-40 del sitemap)
"""
import os
import sys
import requests
import xml.etree.ElementTree as ET
import time
import re
import random
import json
from datetime import datetime
from html.parser import HTMLParser

from dotenv import load_dotenv
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento
from app.services.ocr_service import procesar_datos_completos

app = create_app()

MERCADONA_SITEMAP = "https://tienda.mercadona.es/sitemap.xml"
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

def limpiar_html(texto):
    """Limpia tags HTML del texto."""
    if not texto:
        return ""
    # Reemplazar tags HTML comunes
    texto = re.sub(r'<[^>]+>', '', texto)
    # Decodificar entidades HTML comunes
    texto = texto.replace('&aacute;', 'á').replace('&eacute;', 'é').replace('&iacute;', 'í')
    texto = texto.replace('&oacute;', 'ó').replace('&uacute;', 'ú').replace('&ntilde;', 'ñ')
    texto = texto.strip()
    return texto

def procesar_ingredientes_old(texto):
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

def procesar_ingredientes(texto):
    """Procesa lista de ingredientes con separadores inteligentes.

    Estrategia:
    1. Dividir por comas que están fuera de paréntesis
    2. Para cada ingrediente, procesar sus paréntesis
    3. Manejar categorías de compuestos de manera inteligente
    """
    if not texto:
        return []

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

    # Dividir por comas FUERA de paréntesis
    def dividir_por_comas_fuera_parentesis(txt):
        """Divide por comas que no están dentro de paréntesis."""
        partes = []
        parte_actual = []
        nivel_parentesis = 0

        for char in txt:
            if char == '(':
                nivel_parentesis += 1
                parte_actual.append(char)
            elif char == ')':
                nivel_parentesis -= 1
                parte_actual.append(char)
            elif char == ',' and nivel_parentesis == 0:
                partes.append(''.join(parte_actual).strip())
                parte_actual = []
            else:
                parte_actual.append(char)

        if parte_actual:
            partes.append(''.join(parte_actual).strip())

        return partes

    # Procesar cada ingrediente
    ingredientes_raw = dividir_por_comas_fuera_parentesis(texto)
    ingredientes = []

    for ing_raw in ingredientes_raw:
        if not ing_raw or len(ing_raw) <= 2:
            continue

        # Procesar paréntesis en este ingrediente
        def procesar_ingrediente_individual(ing):
            """Procesa un ingrediente individual."""
            # Encontrar paréntesis y procesar contenido
            while '(' in ing and ')' in ing:
                match = re.search(r'([^()]*)\(([^()]*)\)', ing)
                if not match:
                    break

                base = match.group(1).strip()
                contenido = match.group(2).strip()

                # Obtener palabra clave
                palabras = base.lower().split()
                palabra_clave = palabras[-1] if palabras else ''

                # Si es categoría de compuestos, extraer solo los compuestos
                if palabra_clave in categorias_compuestos:
                    # Dividir compuestos por coma o "y"
                    compuestos = re.split(r',|\s+y\s+', contenido, flags=re.IGNORECASE)
                    compuestos = [c.strip() for c in compuestos if c.strip() and len(c.strip()) > 2]
                    # No incluir la palabra clave, solo los compuestos
                    reemplazo = ' y '.join(compuestos) if compuestos else ''
                else:
                    # Si contiene E-xxx, son aditivos que sí queremos
                    if re.search(r'E-?\d{3,4}', contenido):
                        reemplazo = contenido
                    else:
                        # Información adicional (%, origen) -> eliminar paréntesis pero PRESERVAR base
                        reemplazo = base

                ing = ing[:match.start()] + reemplazo + ing[match.end():]

            return ing.strip()

        ing_procesado = procesar_ingrediente_individual(ing_raw)

        # Limpiar espacios extras
        ing_procesado = re.sub(r'\s+', ' ', ing_procesado)

        # Si tiene múltiples ingredientes separados por " y ", dividirlos
        if ' y ' in ing_procesado.lower():
            subingredientes = re.split(r'\s+y\s+', ing_procesado, flags=re.IGNORECASE)
            for sub in subingredientes:
                sub = sub.strip()
                # Limpiar caracteres especiales finales
                sub = re.sub(r'[.,;:\s]+$', '', sub)
                if sub and len(sub) > 2:
                    ingredientes.append(sub)
        elif ing_procesado and len(ing_procesado) > 2:
            # Limpiar caracteres especiales finales
            ing_procesado = re.sub(r'[.,;:\s]+$', '', ing_procesado)
            ingredientes.append(ing_procesado)

    return ingredientes

def esperar():
    delay = DELAY_SEGUNDOS + random.uniform(1, 3)
    print(f"    [WAIT] {delay:.1f}s...", end='', flush=True)
    time.sleep(delay)
    print(" OK")

def registrar_fallo(product_id, nombre, motivo):
    return {
        'product_id': product_id,
        'nombre': nombre,
        'motivo': motivo,
        'timestamp': datetime.now().isoformat()
    }

def guardar_fallos(fallos):
    with open('scrape_fallos.json', 'w') as f:
        json.dump(fallos, f, indent=2)
    print(f"\n[FALLOS] Guardados {len(fallos['fallos'])} fallos")

def descargar_sitemap():
    print("[*] Descargando sitemap...")
    try:
        headers = {'User-Agent': obtener_user_agent()}
        response = requests.get(MERCADONA_SITEMAP, timeout=15, headers=headers)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        namespace = {'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        ids = []
        for url_elem in root.findall('sitemap:url', namespace):
            loc = url_elem.find('sitemap:loc', namespace)
            if loc is not None:
                url = loc.text
                if '/product/' in url:
                    match = re.search(r'/product/(\d+)/', url)
                    if match:
                        ids.append(match.group(1))
        return ids
    except Exception as e:
        print(f"[ERROR] {e}")
        return []

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

def descargar_imagen(url):
    try:
        headers = {'User-Agent': obtener_user_agent()}
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        return response.content
    except:
        return None

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
    ean = datos_api.get('ean', '')

    # Limpiar nombre removiendo la marca
    display_name = limpiar_nombre_producto(display_name, marca)
    ingredientes = []
    nutrition_info = datos_completos.get('nutrition_information', {})
    if isinstance(nutrition_info, dict):
        ingredients_text = nutrition_info.get('ingredients', '')
        if ingredients_text:
            # Limpiar HTML
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
                    # Buscar o crear ingrediente
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
        print(f"        [ERROR] Guardando: {e}")
        return None

print("=" * 60)
print("[INICIO] Scraper Mercadona - Lote 2 (productos 20-40)")
print("=" * 60)

ids = descargar_sitemap()
print(f"[OK] {len(ids)} productos en sitemap")

ids = ids[20:40]
print(f"[INFO] Procesando {len(ids)} productos (índices 20-40)...\n")

contadores = {'total': 20, 'procesados': 0, 'con_ocr': 0, 'en_bd': 0, 'errores': 0, 'ya_existentes': 0}
fallos = {'fallos': []}

for i, product_id in enumerate(ids, 1):
    print(f"[{i}/20]", end=" ")
    datos_api = obtener_datos_producto(product_id)
    if not datos_api:
        print(f"[SKIP] API error")
        contadores['errores'] += 1
        fallos['fallos'].append(registrar_fallo(product_id, 'Desconocido', 'Error API'))
        esperar()
        continue
    if datos_api.get('ean') and producto_ya_existe(datos_api['ean']):
        print(f"[SKIP] Existe")
        contadores['ya_existentes'] += 1
        esperar()
        continue
    datos = procesar_producto(datos_api)
    contadores['procesados'] += 1
    if datos:
        contadores['con_ocr'] += 1
        alimento = guardar_en_bd(datos)
        if alimento:
            contadores['en_bd'] += 1
        else:
            contadores['errores'] += 1
            fallos['fallos'].append(registrar_fallo(product_id, datos_api.get('nombre', ''), 'Error BD'))
    else:
        contadores['errores'] += 1
        fallos['fallos'].append(registrar_fallo(product_id, datos_api.get('nombre', ''), 'Sin macros'))
    esperar()

print("\n" + "=" * 60)
print("[RESUMEN]")
print("=" * 60)
print(f"Total a procesar: {contadores['total']}")
print(f"Ya existentes: {contadores['ya_existentes']}")
print(f"Nuevos procesados: {contadores['procesados']}")
print(f"Con OCR/API exitoso: {contadores['con_ocr']}")
print(f"Guardados en BD: {contadores['en_bd']}")
print(f"Errores: {contadores['errores']}")
print("=" * 60)

if fallos['fallos']:
    guardar_fallos(fallos)
