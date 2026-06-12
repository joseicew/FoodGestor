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
    """Parser robusto para ingredientes con manejo de paréntesis desbalanceados."""
    if not texto:
        return []

    # Paso 1: Balancear paréntesis desbalanceados
    aperturas = texto.count('(')
    cierres = texto.count(')')

    if cierres > aperturas:
        for _ in range(cierres - aperturas):
            idx = texto.find(')')
            if idx != -1:
                texto = texto[:idx] + texto[idx+1:]
    elif aperturas > cierres:
        for _ in range(aperturas - cierres):
            idx = texto.rfind('(')
            if idx != -1:
                texto = texto[:idx] + texto[idx+1:]

    # Paso 2: Dividir por separadores principales (coma y punto fuera de paréntesis)
    partes = []
    actual = []
    nivel = 0

    for char in texto:
        if char == '(':
            nivel += 1
            actual.append(char)
        elif char == ')':
            nivel -= 1
            actual.append(char)
        elif (char == ',' or char == '.') and nivel == 0:
            parte = ''.join(actual).strip()
            if parte:
                partes.append(parte)
            actual = []
        else:
            actual.append(char)

    if actual:
        parte = ''.join(actual).strip()
        if parte:
            partes.append(parte)

    # Paso 3: Procesar cada parte
    ingredientes = []

    for parte in partes:
        # 3a: Remover paréntesis y su contenido (recursivamente)
        parte_limpia = parte
        max_iter = 10
        while '(' in parte_limpia and max_iter > 0:
            parte_nueva = re.sub(r'\([^()]*\)', '', parte_limpia)
            if parte_nueva == parte_limpia:
                # No hay cambios, hay desbalance, remover todos
                parte_limpia = parte_limpia.replace('(', '').replace(')', '')
                break
            parte_limpia = parte_nueva
            max_iter -= 1

        # 3b: Limpiar espacios múltiples
        parte_limpia = re.sub(r'\s+', ' ', parte_limpia).strip()

        # 3c: Remover caracteres especiales al inicio/final
        parte_limpia = re.sub(r'^[)\]\}]+\s*', '', parte_limpia)
        parte_limpia = re.sub(r'\s*[(\[\{]+$', '', parte_limpia)

        # 3d: Remover porcentajes sueltos
        parte_limpia = re.sub(r'\s*\d+[.,]\d*%\s*', ' ', parte_limpia)

        # 3e: Limpiar dos puntos seguidos de espacios
        parte_limpia = re.sub(r':\s+', ': ', parte_limpia)
        # Si tiene dos puntos y solo el lado derecho es E-xxx, quedarse con eso
        if ':' in parte_limpia:
            partes_dos_puntos = parte_limpia.split(':')
            if len(partes_dos_puntos) == 2:
                derecha = partes_dos_puntos[1].strip()
                # Si el lado derecho es un código E-xxx o algo importante, usar eso
                if re.search(r'E-?\d+|vitamina|ácido', derecha, re.IGNORECASE):
                    parte_limpia = derecha
                # Si el lado izquierdo es una categoría (estabilizador, colorante) e izq está vacío
                elif re.search(r'estabilizador|colorante|conservante|emulgente|aditivo', partes_dos_puntos[0], re.IGNORECASE):
                    parte_limpia = derecha if derecha else partes_dos_puntos[0]

        # 3f: Dividir por " y " si tiene múltiples ingredientes
        if ' y ' in parte_limpia.lower():
            subpartes = re.split(r'\s+y\s+', parte_limpia, flags=re.IGNORECASE)
            for subparte in subpartes:
                subparte = subparte.strip()
                subparte = re.sub(r':\s*', ': ', subparte)
                # Si tiene dos puntos, procesar
                if ':' in subparte:
                    izq, der = subparte.split(':', 1)
                    izq = izq.strip()
                    der = der.strip()
                    # Siempre usar derecha si existe, excepto si está vacía
                    if der:
                        subparte = der
                    elif izq:
                        subparte = izq

                subparte = re.sub(r'\s+', ' ', subparte).strip()
                if (len(subparte) > 2 and
                    not re.search(r'origen|fabricad', subparte, re.IGNORECASE)):
                    ingredientes.append(subparte)
            continue

        # 3g: Limpiar espacios finales
        parte_limpia = re.sub(r'\s+', ' ', parte_limpia).strip()

        # 3h: Filtrar vacíos, muy cortos y origen
        if (len(parte_limpia) > 2 and
            not re.search(r'origen|fabricad', parte_limpia, re.IGNORECASE)):
            ingredientes.append(parte_limpia)

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
    if not nombre or not marca or marca == 'Sin marca':
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

    # Intentar extraer categoría del API
    categoria = 'Otros'
    if 'categories' in datos_completos and datos_completos['categories']:
        categorias = datos_completos['categories']
        if isinstance(categorias, list) and len(categorias) > 0:
            categoria = categorias[-1].get('name', 'Otros') if isinstance(categorias[-1], dict) else str(categorias[-1])
    elif 'category' in datos_completos:
        cat = datos_completos['category']
        categoria = cat.get('name', 'Otros') if isinstance(cat, dict) else str(cat)

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
        return {'nombre': display_name, 'marca': marca, 'ean': ean, 'ingredientes': ingredientes, 'macros': macros, 'categoria': categoria}
    return None

def guardar_en_bd(datos):
    try:
        with app.app_context():
            from app.models import Ingrediente

            marca = datos.get('marca') or 'Sin marca'
            categoria = datos.get('categoria', 'Otros')
            alimento = Alimento(
                nombre=datos.get('nombre'),
                marca=marca,
                codigo_barras=datos.get('ean'),
                categoria=categoria,
                calorias=datos.get('macros', {}).get('calorias'),
                proteinas=datos.get('macros', {}).get('proteinas'),
                grasas=datos.get('macros', {}).get('grasas'),
                grasas_saturadas=datos.get('macros', {}).get('grasas_saturadas'),
                hidratos_carbono=datos.get('macros', {}).get('hidratos_carbono'),
                azucares=datos.get('macros', {}).get('azucares'),
                fibra=datos.get('macros', {}).get('fibra'),
                sal=datos.get('macros', {}).get('sal'),
            )

            # Guardar ingredientes (sin verificar por defecto)
            ingredientes = datos.get('ingredientes', [])
            for ing_nombre in ingredientes:
                if ing_nombre.strip():
                    # Buscar o crear ingrediente
                    ingrediente = Ingrediente.query.filter_by(nombre=ing_nombre.strip()).first()
                    if not ingrediente:
                        # Nuevo ingrediente del scraper - sin verificar alérgenos/intolerancias
                        ingrediente = Ingrediente(
                            nombre=ing_nombre.strip(),
                            verificado=False  # Pendiente de valorar alergenos/intolerancias
                        )
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
