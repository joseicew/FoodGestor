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
basedir = os.path.abspath(os.path.dirname(__file__))
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

def procesar_producto(datos_api):
    nombre = datos_api.get('nombre', 'N/A')
    print(f"  [PROC] {nombre[:50]}")
    datos_completos = datos_api.get('datos_completos', {})
    display_name = datos_completos.get('display_name', datos_api.get('nombre', 'Sin nombre'))
    marca = datos_api.get('marca') or 'Sin marca'
    ean = datos_api.get('ean', '')

    # Extraer ingredientes
    ingredientes = []
    nutrition_info = datos_completos.get('nutrition_information', {})
    if isinstance(nutrition_info, dict):
        ingredients_text = nutrition_info.get('ingredients', '')
        if ingredients_text:
            ingredients_text = limpiar_html(ingredients_text)
            ingredientes = [i.strip() for i in ingredients_text.split(',') if i.strip()]

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
