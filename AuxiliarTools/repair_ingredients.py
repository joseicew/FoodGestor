#!/usr/bin/env python3
"""
Script para reparar productos sin ingredientes
"""
import os
import sys
import requests
import re
import time
import random
from datetime import datetime

from dotenv import load_dotenv
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento, Ingrediente
from app.services.ocr_service import procesar_datos_completos

app = create_app()

MERCADONA_API = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
]

def obtener_user_agent():
    return random.choice(USER_AGENTS)

def limpiar_html(texto):
    """Limpia tags HTML del texto."""
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = texto.replace('&aacute;', 'á').replace('&eacute;', 'é').replace('&iacute;', 'í')
    texto = texto.replace('&oacute;', 'ó').replace('&uacute;', 'ú').replace('&ntilde;', 'ñ')
    texto = texto.strip()
    return texto

def esperar():
    delay = 2 + random.uniform(0.5, 1.5)
    time.sleep(delay)

def obtener_ean_producto(alimento):
    """Obtiene el EAN del producto para usarlo como ID de búsqueda."""
    # Intentar obtener el ID del producto desde el EAN usando la API de búsqueda
    # O simplemente usar el EAN como aproximación
    return alimento.codigo_barras

def obtener_ingredientes_api(product_id):
    """Obtiene ingredientes de la API de Mercadona."""
    try:
        headers = {'User-Agent': obtener_user_agent()}
        url = MERCADONA_API.format(id=product_id)
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        data = response.json()

        nutrition_info = data.get('nutrition_information', {})
        if isinstance(nutrition_info, dict):
            ingredients_text = nutrition_info.get('ingredients', '')
            if ingredients_text:
                ingredients_text = limpiar_html(ingredients_text)
                ingredientes = [i.strip() for i in ingredients_text.split(',') if i.strip()]
                return ingredientes
        return []
    except Exception as e:
        print(f"      [ERROR] API: {e}")
        return []

def buscar_product_id_en_api(ean):
    """Intenta encontrar el ID del producto en la API usando el EAN."""
    # Mercadona no tiene búsqueda directa por EAN, así que usamos el ID que ya tenemos
    # (asumiendo que el EAN corresponde al producto en la BD)
    return None

# MAIN
print("=" * 70)
print("[INICIO] Reparando productos sin ingredientes")
print("=" * 70)

with app.app_context():
    # Encontrar productos sin ingredientes
    sin_ingredientes = Alimento.query.filter(
        ~Alimento.ingredientes.any()
    ).all()

    print(f"[INFO] Encontrados {len(sin_ingredientes)} productos sin ingredientes\n")

    reparados = 0
    fallos = 0

    for i, alimento in enumerate(sin_ingredientes, 1):
        print(f"[{i}/{len(sin_ingredientes)}] {alimento.nombre[:40]}")

        # Intentar obtener ingredientes de la API
        # Usamos el nombre como búsqueda aproximada
        product_id = None

        # Intenta con algunos IDs cercanos (asumiendo que están en secuencia)
        # O simplemente omitir si no tenemos el ID

        if alimento.codigo_barras:
            # Usar el EAN como aproximación (algunos productos lo usan)
            # En este caso, asumimos que el ID está en la BD o es derivable
            # Por ahora simplemente saltamos esto
            pass

        # Para ser simple: si no tenemos ID, no podemos reparar
        print(f"  [SKIP] Sin ID de producto en API")
        esperar()
        continue

        ingredientes = obtener_ingredientes_api(product_id)

        if ingredientes:
            # Asociar ingredientes
            for ing_nombre in ingredientes:
                if ing_nombre.strip():
                    ingrediente = Ingrediente.query.filter_by(nombre=ing_nombre.strip()).first()
                    if not ingrediente:
                        ingrediente = Ingrediente(nombre=ing_nombre.strip())
                        db.session.add(ingrediente)
                        db.session.flush()
                    if ingrediente not in alimento.ingredientes:
                        alimento.ingredientes.append(ingrediente)

            db.session.commit()
            print(f"  [OK] {len(ingredientes)} ingredientes añadidos")
            reparados += 1
        else:
            print(f"  [FAIL] Sin ingredientes en API")
            fallos += 1

        esperar()

    print("\n" + "=" * 70)
    print("[RESUMEN]")
    print("=" * 70)
    print(f"Total sin ingredientes: {len(sin_ingredientes)}")
    print(f"Reparados: {reparados}")
    print(f"Fallos: {fallos}")
    print("=" * 70)
    print("\nNota: Para reparar completamente, necesitamos mapear producto_id de BD con API.")
    print("Alternativamente, reintentar el scraping es más eficiente.")
