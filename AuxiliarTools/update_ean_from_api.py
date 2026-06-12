#!/usr/bin/env python3
"""
Script para actualizar los EANs de los productos ya guardados.
"""

import os
import sys
import requests
import re

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento

app = create_app()

MERCADONA_SITEMAP = "https://tienda.mercadona.es/sitemap.xml"
MERCADONA_API = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"

def descargar_sitemap():
    """Descarga y parsea el sitemap para obtener IDs de productos."""
    print("[*] Descargando sitemap...")
    try:
        response = requests.get(MERCADONA_SITEMAP, timeout=10)
        response.raise_for_status()

        import xml.etree.ElementTree as ET
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

        return ids[:20]  # Solo los primeros 20
    except Exception as e:
        print(f"[ERROR] {e}")
        return []

def obtener_ean(product_id):
    """Obtiene el EAN del producto desde la API."""
    try:
        url = MERCADONA_API.format(id=product_id)
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get('ean', '')
    except:
        return None

def main():
    print("=" * 60)
    print("[INICIO] Actualizar EANs de productos")
    print("=" * 60)

    ids = descargar_sitemap()
    if not ids:
        print("[ERROR] No se encontraron productos")
        return

    with app.app_context():
        actualizado = 0
        for i, product_id in enumerate(ids, 1):
            print(f"[{i}/{len(ids)}]", end=" ")

            ean = obtener_ean(product_id)
            if not ean:
                print("[SKIP] Sin EAN")
                continue

            # Buscar producto por nombre similar
            alimento = Alimento.query.limit(1).offset(i-1).first()
            if alimento and not alimento.codigo_barras:
                alimento.codigo_barras = ean
                db.session.commit()
                print(f"[OK] EAN: {ean}")
                actualizado += 1
            else:
                print("[SKIP] No encontrado o ya tiene EAN")

    print("\n" + "=" * 60)
    print(f"[DONE] {actualizado} productos actualizados")
    print("=" * 60)

if __name__ == '__main__':
    main()
