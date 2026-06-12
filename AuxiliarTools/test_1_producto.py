#!/usr/bin/env python3
"""
Test: Scrapeir solo 1 producto para validar el pipeline completo
"""
import os
import sys
import requests
import xml.etree.ElementTree as ET
import re
import random
import time

from dotenv import load_dotenv
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento, Ingrediente
from app.services.ocr_service import procesar_datos_completos

app = create_app()

MERCADONA_SITEMAP = "https://tienda.mercadona.es/sitemap.xml"
MERCADONA_API = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
]

def obtener_user_agent():
    return random.choice(USER_AGENTS)

def limpiar_html(texto):
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = texto.replace('&aacute;', 'á').replace('&eacute;', 'é').replace('&iacute;', 'í')
    texto = texto.replace('&oacute;', 'ó').replace('&uacute;', 'ú').replace('&ntilde;', 'ñ')
    return texto.strip()

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

    # Dividir por comas y puntos FUERA de paréntesis
    def dividir_por_comas_fuera_parentesis(txt):
        """Divide por comas y puntos que no están dentro de paréntesis."""
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
            elif (char == ',' or char == '.') and nivel_parentesis == 0:
                parte_str = ''.join(parte_actual).strip()
                if parte_str:
                    partes.append(parte_str)
                parte_actual = []
            else:
                parte_actual.append(char)

        if parte_actual:
            parte_str = ''.join(parte_actual).strip()
            if parte_str:
                partes.append(parte_str)

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

        # Remover información de origen/fabricación si está después de un punto
        # Ej: "lactasa. Origen de la leche: España" → "lactasa"
        ing_procesado = re.sub(r'\.?\s*(origen|fabricado|producido|hecho|procedencia|procedente).*?:.*$', '', ing_procesado, flags=re.IGNORECASE).strip()

        # Filtrar información que no es ingrediente
        # Patrones a ignorar: "Origen de:", "Fabricado en:", "Producido en:", etc.
        if re.match(r'(origen|fabricado|producido|hecho|procedencia|procedente)\s+(de|en):', ing_procesado, re.IGNORECASE):
            continue

        # Si tiene múltiples ingredientes separados por " y ", dividirlos
        if ' y ' in ing_procesado.lower():
            subingredientes = re.split(r'\s+y\s+', ing_procesado, flags=re.IGNORECASE)
            for sub in subingredientes:
                sub = sub.strip()
                # Limpiar caracteres especiales finales
                sub = re.sub(r'[.,;:\s]+$', '', sub)
                # Filtrar información (origen, fabricado, etc.)
                if re.match(r'(origen|fabricado|producido|hecho|procedencia|procedente)\s+(de|en):', sub, re.IGNORECASE):
                    continue
                if sub and len(sub) > 2:
                    ingredientes.append(sub)
        elif ing_procesado and len(ing_procesado) > 2:
            # Limpiar caracteres especiales finales
            ing_procesado = re.sub(r'[.,;:\s]+$', '', ing_procesado)
            ingredientes.append(ing_procesado)

    return ingredientes

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
    print(f"  [PROC] {nombre[:50]}")
    datos_completos = datos_api.get('datos_completos', {})
    display_name = datos_completos.get('display_name', datos_api.get('nombre', 'Sin nombre'))
    marca = datos_api.get('marca') or 'Sin marca'
    ean = datos_api.get('ean', '')

    # Limpiar nombre removiendo la marca
    display_name = limpiar_nombre_producto(display_name, marca)

    # Extraer ingredientes
    ingredientes = []
    nutrition_info = datos_completos.get('nutrition_information', {})
    if isinstance(nutrition_info, dict):
        ingredients_text = nutrition_info.get('ingredients', '')
        if ingredients_text:
            ingredients_text = limpiar_html(ingredients_text)
            # Procesar con lógica inteligente de separadores
            ingredientes = procesar_ingredientes(ingredients_text)

    print(f"    Ingredientes extraidos: {len(ingredientes)}")
    if ingredientes:
        print(f"    Primeros 3: {ingredientes[:3]}")

    # Procesar macros
    macros = None
    imagen_urls = datos_api.get('imagen_urls', [])

    if imagen_urls:
        for idx, imagen_url in enumerate(imagen_urls, 1):
            try:
                print(f"    Descargando imagen [{idx}/{len(imagen_urls)}]...")
                img_data = descargar_imagen(imagen_url)
                if not img_data:
                    print(f"    [SKIP] No se pudo descargar")
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
                        print(f"    [OK] Macros: {kcal}kcal, {prot}g prot, {grasas}g grasas, {carbs}g carbs")
                        macros = macros_temp
                        break
            except Exception as e:
                print(f"    [SKIP] {e}")

    if not macros:
        print(f"    [FALLBACK] Intentando macros de API...")
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
        return {'nombre': display_name, 'marca': marca, 'ean': ean, 'ingredientes': ingredientes, 'macros': macros}
    return None

def guardar_en_bd(datos):
    try:
        with app.app_context():
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
            for ing_nombre in datos.get('ingredientes', []):
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
        print(f"    [ERROR] {e}")
        return None

# MAIN
print("=" * 70)
print("[TEST] Scrapeando 1 PRODUCTO")
print("=" * 70)

ids = descargar_sitemap()
print(f"[OK] {len(ids)} productos en sitemap")

# Tomar solo el primer producto
test_id = ids[0]
print(f"[TEST] Procesando producto ID: {test_id}\n")

datos_api = obtener_datos_producto(test_id)
if not datos_api:
    print("[ERROR] No se obtuvieron datos de API")
    sys.exit(1)

print(f"[API] Datos obtenidos: {datos_api['nombre']}")
print(f"      Marca: {datos_api['marca']}")
print(f"      EAN: {datos_api['ean']}")
print(f"      Imagenes: {len(datos_api['imagen_urls'])}\n")

datos = procesar_producto(datos_api)

if not datos:
    print("[ERROR] No se pudo procesar el producto")
    sys.exit(1)

print(f"\n[GUARDANDO]")
alimento = guardar_en_bd(datos)

if not alimento:
    print("[ERROR] No se pudo guardar en BD")
    sys.exit(1)

# Verificar lo guardado
print("\n" + "=" * 70)
print("[VERIFICACION]")
print("=" * 70)

with app.app_context():
    guardado = Alimento.query.filter_by(codigo_barras=datos['ean']).first()

    if guardado:
        print(f"ID: {guardado.id}")
        print(f"Nombre: {guardado.nombre}")
        print(f"Marca: {guardado.marca}")
        print(f"EAN: {guardado.codigo_barras}")
        print(f"\n[MACROS]")
        print(f"  Calorias: {guardado.calorias} kcal")
        print(f"  Proteinas: {guardado.proteinas}g")
        print(f"  Grasas: {guardado.grasas}g")
        print(f"  Carbohidratos: {guardado.hidratos_carbono}g")
        print(f"  Azucares: {guardado.azucares}g")
        print(f"  Fibra: {guardado.fibra}g")
        print(f"  Sal: {guardado.sal}g")
        print(f"\n[INGREDIENTES]")
        print(f"  Total: {len(guardado.ingredientes)}")
        for ing in guardado.ingredientes[:10]:
            print(f"    - {ing.nombre}")
        if len(guardado.ingredientes) > 10:
            print(f"    ... y {len(guardado.ingredientes) - 10} mas")
        print("\n[OK] TEST EXITOSO")
    else:
        print("[ERROR] Producto no encontrado en BD")

print("=" * 70)
