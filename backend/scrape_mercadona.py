#!/usr/bin/env python3
"""
Script para descargar 20 productos de Mercadona via API y procesar con OCR.
Uso: python scrape_mercadona.py
"""

import os
import sys
import requests
import xml.etree.ElementTree as ET
import time
import re
from pathlib import Path

# Cargar .env
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

# Importar app
sys.path.insert(0, basedir)
from app import create_app
from app.models import Alimento
from app.services.ocr_service import procesar_datos_completos

app = create_app()

MERCADONA_SITEMAP = "https://tienda.mercadona.es/sitemap.xml"
MERCADONA_API = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"
MAX_PRODUCTOS = 20
DELAY_SEGUNDOS = 0.5

def descargar_sitemap():
    """Descarga y parsea el sitemap para obtener IDs de productos."""
    print("[*] Descargando sitemap...")
    try:
        response = requests.get(MERCADONA_SITEMAP, timeout=10)
        response.raise_for_status()

        root = ET.fromstring(response.content)
        namespace = {'sitemap': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

        ids = []
        for url_elem in root.findall('sitemap:url', namespace):
            loc = url_elem.find('sitemap:loc', namespace)
            if loc is not None:
                url = loc.text
                if '/product/' in url:
                    # Extraer ID de la URL: /product/{id}/nombre
                    match = re.search(r'/product/(\d+)/', url)
                    if match:
                        ids.append(match.group(1))

        return ids
    except Exception as e:
        print(f"[ERROR] Error descargando sitemap: {e}")
        return []

def producto_ya_existe(ean):
    """Verifica si un producto ya existe en la BD por EAN."""
    if not ean:
        return False

    try:
        with app.app_context():
            existe = Alimento.query.filter_by(codigo_barras=ean).first()
            return existe is not None
    except Exception:
        return False

def obtener_datos_producto(product_id):
    """Obtiene datos del producto desde la API de Mercadona."""
    try:
        url = MERCADONA_API.format(id=product_id)
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()

        # Extraer datos importantes
        nombre = data.get('slug', '').replace('-', ' ').title()
        marca = data.get('brand', 'Sin marca')
        ean = data.get('ean', '')

        # Obtener imágenes del array photos
        # Priorizar segunda imagen (índice 1) que típicamente tiene las macros
        imagen_urls = []
        photos = data.get('photos', [])
        if photos and len(photos) > 1:
            # Intentar segunda imagen primero (usually has macros)
            imagen_urls.append(photos[1].get('regular', ''))
        if photos and len(photos) > 0:
            # Luego primera imagen
            imagen_urls.append(photos[0].get('regular', ''))

        return {
            'id': product_id,
            'nombre': nombre,
            'marca': marca,
            'ean': ean,
            'imagen_urls': imagen_urls,  # Array en lugar de una sola URL
            'datos_completos': data
        }
    except Exception as e:
        print(f"      [ERROR] API: {e}")
        return None

def descargar_imagen(url_imagen):
    """Descarga una imagen y la retorna como bytes."""
    try:
        response = requests.get(url_imagen, timeout=10)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"      [ERROR] Descargando imagen: {e}")
        return None

def procesar_producto(datos_api):
    """Procesa un producto: intenta OCR en imágenes, fallback a datos de API."""
    nombre = datos_api.get('nombre', 'N/A')
    print(f"  [PROC] {nombre[:40]}")

    imagen_urls = datos_api.get('imagen_urls', [])

    # Intentar procesar cada imagen con OCR
    if imagen_urls:
        for idx, imagen_url in enumerate(imagen_urls, 1):
            try:
                # Descargar imagen
                print(f"    Descargando imagen [{idx}/{len(imagen_urls)}]...")
                img_data = descargar_imagen(imagen_url)
                if not img_data:
                    print(f"    [SKIP] No se pudo descargar imagen {idx}")
                    continue

                # Procesar con OCR
                print(f"    Procesando con OCR...")
                datos_ocr = procesar_datos_completos(img_data, 'image/jpeg')

                if datos_ocr:
                    # Validar que tenga datos nutricionales completos
                    macros = datos_ocr.get('macros', {})
                    kcal = macros.get('calorias')
                    prot = macros.get('proteinas')
                    grasas = macros.get('grasas')
                    carbs = macros.get('hidratos_carbono')

                    # Si tiene datos nutricionales completos, usar esta imagen
                    if kcal and prot is not None and grasas is not None and carbs is not None:
                        print(f"    [OK] OCR exitoso: {datos_ocr.get('nombre', 'N/A')[:40]}")
                        # Combinar datos de API con OCR
                        datos_ocr['ean'] = datos_api.get('ean', '')
                        return datos_ocr
                    else:
                        print(f"    [SKIP] Imagen {idx}: Macros incompletas")
                        continue
                else:
                    print(f"    [SKIP] Imagen {idx}: OCR vacío")
                    continue

            except Exception as e:
                print(f"    [SKIP] Imagen {idx}: {e}")
                continue

    # Fallback: usar datos directamente de la API si OCR falló
    print(f"    [FALLBACK] Usando datos de la API")
    try:
        datos_completos = datos_api.get('datos_completos', {})

        # Extraer información nutricional
        nutrition_info = datos_completos.get('nutrition_information', {})

        # Intentar extraer macros del JSON
        kcal = None
        prot = None
        grasas = None
        carbs = None

        # La información nutricional puede estar en diferentes formatos
        if isinstance(nutrition_info, dict):
            # Buscar valores de macros en el diccionario
            kcal = nutrition_info.get('energy') or nutrition_info.get('kcal') or nutrition_info.get('calories')
            prot = nutrition_info.get('protein') or nutrition_info.get('proteins')
            grasas = nutrition_info.get('fat') or nutrition_info.get('fats')
            carbs = nutrition_info.get('carbohydrate') or nutrition_info.get('carbohydrates')

        # Si faltan macros, no usar este producto
        if not (kcal and prot is not None and grasas is not None and carbs is not None):
            print(f"    [SKIP] API: Macros incompletas en nutrition_information")
            return None

        # Extraer ingredientes
        ingredientes = []
        if isinstance(nutrition_info, dict) and 'ingredients' in nutrition_info:
            ingredients_text = nutrition_info.get('ingredients', '')
            if ingredients_text:
                # Parsear ingredientes separados por comas
                ingredientes = [i.strip() for i in ingredients_text.split(',')]

        print(f"    [OK] API fallback: {datos_completos.get('display_name', nombre)[:40]}")

        return {
            'nombre': datos_completos.get('display_name', datos_api.get('nombre', '')),
            'marca': datos_api.get('marca', 'Sin marca'),
            'ean': datos_api.get('ean', ''),
            'ingredientes': ingredientes,
            'macros': {
                'calorias': kcal,
                'proteinas': prot,
                'grasas': grasas,
                'hidratos_carbono': carbs,
                'azucares': nutrition_info.get('sugar') if isinstance(nutrition_info, dict) else None,
                'fibra': nutrition_info.get('fiber') if isinstance(nutrition_info, dict) else None,
                'sal': nutrition_info.get('sodium') or nutrition_info.get('salt') if isinstance(nutrition_info, dict) else None,
            }
        }

    except Exception as e:
        print(f"    [FAIL] API fallback error: {e}")
        return None

def guardar_en_bd(datos_ocr):
    """Guarda los datos extraídos en la base de datos."""
    try:
        with app.app_context():
            # Usar nombre del OCR si existe, sino usar nombre de API
            nombre = datos_ocr.get('nombre') or datos_ocr.get('nombre_api', 'Sin nombre')

            alimento = Alimento(
                nombre=nombre,
                marca=datos_ocr.get('marca', 'Sin marca'),
                codigo_barras=datos_ocr.get('ean') or datos_ocr.get('codigo_barras'),
                categoria='Otros',
                calorias=datos_ocr.get('macros', {}).get('calorias'),
                proteinas=datos_ocr.get('macros', {}).get('proteinas'),
                grasas=datos_ocr.get('macros', {}).get('grasas'),
                hidratos_carbono=datos_ocr.get('macros', {}).get('hidratos_carbono'),
                azucares=datos_ocr.get('macros', {}).get('azucares'),
                fibra=datos_ocr.get('macros', {}).get('fibra'),
                sal=datos_ocr.get('macros', {}).get('sal'),
            )
            from app import db
            db.session.add(alimento)
            db.session.commit()
            print(f"      [SAVE] Guardado en BD")
            return alimento
    except Exception as e:
        print(f"      [ERROR] Guardando: {e}")
        return None

def main():
    """Función principal."""
    print("=" * 60)
    print("[INICIO] Scraper Mercadona - API")
    print("=" * 60)

    ids = descargar_sitemap()
    if not ids:
        print("[ERROR] No se encontraron productos")
        return

    print(f"[OK] Encontrados {len(ids)} productos")

    ids = ids[:MAX_PRODUCTOS]
    print(f"[INFO] Procesando {len(ids)} productos...\n")

    contadores = {
        'total': len(ids),
        'procesados': 0,
        'con_ocr': 0,
        'en_bd': 0,
        'errores': 0,
        'ya_existentes': 0
    }

    for i, product_id in enumerate(ids, 1):
        print(f"[{i}/{len(ids)}]", end=" ")

        # Obtener datos desde API
        datos_api = obtener_datos_producto(product_id)
        if not datos_api:
            print(f"[SKIP] No se obtuvieron datos de API")
            contadores['errores'] += 1
            time.sleep(DELAY_SEGUNDOS)
            continue

        # Verificar si el producto ya existe
        if datos_api.get('ean') and producto_ya_existe(datos_api['ean']):
            print(f"[SKIP] Producto ya existe (EAN: {datos_api['ean']})")
            contadores['ya_existentes'] += 1
            time.sleep(DELAY_SEGUNDOS)
            continue

        # Procesar producto (descargar imagen y OCR)
        datos = procesar_producto(datos_api)
        contadores['procesados'] += 1

        if datos:
            contadores['con_ocr'] += 1
            alimento = guardar_en_bd(datos)
            if alimento:
                contadores['en_bd'] += 1
        else:
            contadores['errores'] += 1

        time.sleep(DELAY_SEGUNDOS)

    print("\n" + "=" * 60)
    print("[RESUMEN]")
    print("=" * 60)
    print(f"Total a procesar: {contadores['total']}")
    print(f"Ya existentes: {contadores['ya_existentes']}")
    print(f"Nuevos procesados: {contadores['procesados']}")
    print(f"Con OCR exitoso: {contadores['con_ocr']}")
    print(f"Guardados en BD: {contadores['en_bd']}")
    print(f"Errores: {contadores['errores']}")
    print("=" * 60)

if __name__ == '__main__':
    main()
