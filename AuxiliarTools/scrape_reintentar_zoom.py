#!/usr/bin/env python3
"""
Reintenta los fallos 'Sin macros' usando imágenes zoom (3600x3600).
Filtra los no-alimentarios antes de intentar OCR.
"""

import os, sys, json, time, random, argparse
from datetime import datetime
from pathlib import Path

import requests

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app
from app.models.alimento import Alimento, db
from app.models.ingrediente import Ingrediente

# Reutiliza funciones del scraper principal
sys.path.insert(0, os.path.dirname(__file__))
from scrape_continuar import (
    procesar_producto, guardar_en_bd, ean_en_bd,
    es_no_alimentario, obtener_datos_api, descargar_imagen,
    KEYWORDS_NO_ALIMENTARIO,
    limpiar_nombre, procesar_ingredientes, normalizar_categoria,
    limpiar_html, esperar
)
from app.services.ocr_service import procesar_macros

app = create_app()

FALLOS_PATH   = Path(__file__).parent / 'scrape_fallos.json'
PROCESADOS_PATH = Path(__file__).parent / 'scrape_procesados.json'

def cargar_fallos():
    data = json.loads(FALLOS_PATH.read_text(encoding='utf-8'))
    return data.get('fallos', [])

def cargar_procesados():
    if PROCESADOS_PATH.exists():
        data = json.loads(PROCESADOS_PATH.read_text(encoding='utf-8'))
        return set(data.get('ids', []))
    return set()

def guardar_procesado(pid, ids_set):
    ids_set.add(str(pid))
    PROCESADOS_PATH.write_text(
        json.dumps({'ids': list(ids_set)}, ensure_ascii=False, indent=2),
        encoding='utf-8'
    )

def quitar_de_fallos(pid):
    """Elimina un product_id de fallos.json (reintento exitoso)."""
    data = json.loads(FALLOS_PATH.read_text(encoding='utf-8'))
    original = len(data['fallos'])
    data['fallos'] = [x for x in data['fallos'] if str(x.get('product_id')) != str(pid)]
    if len(data['fallos']) < original:
        FALLOS_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8'
        )

def anotar_fallo_definitivo(pid, nombre, motivo):
    """Marca como no-alimentario o sin macros definitivo."""
    data = json.loads(FALLOS_PATH.read_text(encoding='utf-8'))
    # Actualizar la entrada existente
    for entry in data['fallos']:
        if str(entry.get('product_id')) == str(pid):
            entry['motivo'] = motivo
            entry['timestamp'] = datetime.now().isoformat()
            break
    FALLOS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8'
    )

def ua():
    return {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

def obtener_datos_api_zoom(product_id):
    """Como obtener_datos_api pero usando imagen zoom."""
    try:
        url = f'https://tienda.mercadona.es/api/products/{product_id}/?lang=es&wh=alc1'
        resp = requests.get(url, timeout=15, headers=ua())
        resp.raise_for_status()
        data = resp.json()
        nombre = data.get('slug', '').replace('-', ' ').title()
        marca  = data.get('brand') or 'Sin marca'
        ean    = data.get('ean', '')
        photos = data.get('photos', [])
        imgs = []
        # zoom primero, fallback a regular
        if len(photos) > 1:
            imgs.append(photos[1].get('zoom', '') or photos[1].get('regular', ''))
        if len(photos) > 0:
            imgs.append(photos[0].get('zoom', '') or photos[0].get('regular', ''))
        return {'id': product_id, 'nombre': nombre, 'marca': marca,
                'ean': ean, 'imagen_urls': imgs, 'raw': data}
    except Exception as e:
        print(f"    [ERROR] API: {e}")
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=200, help='Máximo de productos a reintentar')
    args = parser.parse_args()

    fallos = cargar_fallos()
    procesados = cargar_procesados()

    candidatos = [
        x for x in fallos
        if x.get('motivo') in ('Sin macros (OCR y API)', 'Sin macros definitivo (zoom)', 'Error al guardar en BD')
        and str(x['product_id']) not in procesados
    ]
    # Deduplicar
    vistos = set()
    uniq = []
    for x in candidatos:
        if x['product_id'] not in vistos:
            vistos.add(x['product_id'])
            uniq.append(x)
    candidatos = uniq[:args.n]

    print('=' * 60)
    print(f'[REINTENTO ZOOM] {len(candidatos)} candidatos (máx {args.n})')
    print('=' * 60)

    guardados = 0
    skipped_no_alim = 0
    sin_macros = 0
    errores = 0

    for i, item in enumerate(candidatos, 1):
        pid    = item['product_id']
        nombre = item.get('nombre', pid)
        print(f'\n[{i}/{len(candidatos)}] [{pid}] {nombre[:50]}')

        datos_api = obtener_datos_api_zoom(pid)
        if not datos_api:
            errores += 1
            esperar()
            continue

        # Filtro no-alimentario
        if es_no_alimentario(datos_api):
            print(f'  [SKIP] no alimentario')
            anotar_fallo_definitivo(pid, nombre, 'No alimentario (filtrado)')
            guardar_procesado(pid, procesados)
            skipped_no_alim += 1
            esperar()
            continue

        # EAN ya en BD
        with app.app_context():
            if datos_api['ean'] and ean_en_bd(datos_api['ean']):
                print(f'  [SKIP] EAN ya en BD')
                quitar_de_fallos(pid)
                guardar_procesado(pid, procesados)
                esperar()
                continue

        # OCR con zoom — solo procesar_macros (1 llamada en lugar de 3)
        macros = None
        for idx, url in enumerate(datos_api['imagen_urls'], 1):
            if not url:
                continue
            print(f'  Imagen [{idx}] OCR zoom...', end=' ', flush=True)
            img = descargar_imagen(url)
            if not img:
                print('sin imagen')
                continue
            try:
                m = procesar_macros(img, 'image/jpeg') or {}
                if all(m.get(k) is not None for k in ('calorias', 'proteinas', 'grasas', 'hidratos_carbono')):
                    print(f'ok ({m["calorias"]} kcal)')
                    macros = m
                    datos_api['macros_ocr'] = m
                    break
                else:
                    print('macros incompletas')
            except Exception as e:
                print(f'error: {e}')

        # Fallback macros API
        if not macros:
            nutr = datos_api['raw'].get('nutrition_information', {})
            if isinstance(nutr, dict):
                kcal  = nutr.get('energy') or nutr.get('kcal') or nutr.get('calories')
                prot  = nutr.get('protein') or nutr.get('proteins')
                grasas = nutr.get('fat') or nutr.get('fats')
                carbs = nutr.get('carbohydrate') or nutr.get('carbohydrates')
                if kcal and prot is not None and grasas is not None and carbs is not None:
                    macros = {
                        'calorias': kcal, 'proteinas': prot, 'grasas': grasas,
                        'hidratos_carbono': carbs,
                        'azucares': nutr.get('sugar'),
                        'fibra':    nutr.get('fiber'),
                        'sal':      nutr.get('sodium') or nutr.get('salt'),
                    }
                    print(f'  [FALLBACK API] {kcal} kcal')

        if not macros:
            print('  [FALLO] sin macros definitivo')
            anotar_fallo_definitivo(pid, nombre, 'Sin macros definitivo (zoom)')
            guardar_procesado(pid, procesados)
            sin_macros += 1
            esperar()
            continue

        # Guardar en BD
        raw  = datos_api['raw']
        nombre_limpio = limpiar_nombre(raw.get('display_name', datos_api['nombre']), datos_api['marca'])
        cat_api = None
        cats = raw.get('categories', [])
        if isinstance(cats, list) and cats:
            cat_api = cats[-1].get('name') if isinstance(cats[-1], dict) else str(cats[-1])
        categoria = normalizar_categoria(cat_api)

        nutr = raw.get('nutrition_information', {})
        ing_txt = limpiar_html(nutr.get('ingredients', '')) if isinstance(nutr, dict) else ''
        ingredientes = procesar_ingredientes(ing_txt) if ing_txt else []

        datos = {
            'nombre': nombre_limpio,
            'marca': datos_api['marca'],
            'ean': datos_api['ean'],
            'categoria': categoria,
            'macros': macros,
            'ingredientes': ingredientes,
        }

        try:
            with app.app_context():
                guardar_en_bd(datos)
            print(f'  [OK] guardado')
            quitar_de_fallos(pid)
            guardar_procesado(pid, procesados)
            guardados += 1
        except Exception as e:
            print(f'  [ERROR BD] {e}')
            errores += 1

        if i % 20 == 0:
            print(f'\n--- Progreso: {guardados} guardados, {skipped_no_alim} no-alim, {sin_macros} sin macros, {errores} errores ---\n')

        esperar()

    print('\n' + '=' * 60)
    print(f'[FIN] Guardados: {guardados} | No-alim filtrados: {skipped_no_alim} | Sin macros: {sin_macros} | Errores: {errores}')
    print('=' * 60)


if __name__ == '__main__':
    main()
