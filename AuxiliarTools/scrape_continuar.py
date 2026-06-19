#!/usr/bin/env python3
"""
Scraper continuo de Mercadona.
- Descarga N productos del sitemap que no se hayan intentado antes.
- Salta productos ya en BD (por EAN) y los ya registrados en scrape_fallos.json.
- Hace APPEND a scrape_fallos.json, nunca sobreescribe.

Uso:
    python scrape_continuar.py           # procesa los siguientes 30 productos frescos
    python scrape_continuar.py --n 50    # procesa 50
"""

import os, sys, re, json, time, random, argparse
from datetime import datetime
from pathlib import Path

import requests
import xml.etree.ElementTree as ET

# ── Entorno ────────────────────────────────────────────────────────────────
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models import Alimento, Ingrediente
from app.services.ocr_service import procesar_datos_completos

app = create_app()

# ── Constantes ─────────────────────────────────────────────────────────────
SITEMAP_URL = "https://tienda.mercadona.es/sitemap.xml"
API_URL     = "https://tienda.mercadona.es/api/products/{id}/?lang=es&wh=alc1"
DELAY_BASE  = 3          # segundos mínimos entre requests
FALLOS_FILE     = Path(__file__).parent / 'scrape_fallos.json'
PROCESADOS_FILE = Path(__file__).parent / 'scrape_procesados.json'

CATEGORIAS_VALIDAS = [
    'Carnes y Aves', 'Pescados y Mariscos', 'Lácteos y Huevos',
    'Frutas', 'Verduras y Hortalizas', 'Cereales y Derivados',
    'Legumbres', 'Grasas y Aceites', 'Frutos Secos', 'Bebidas',
    'Snacks y Aperitivos', 'Dulces y Repostería', 'Condimentos y Salsas',
    'Platos Preparados', 'Suplementos', 'Otros',
]

PALABRAS_CATEGORIA = {
    'carne': 'Carnes y Aves', 'pollo': 'Carnes y Aves', 'cerdo': 'Carnes y Aves',
    'pescado': 'Pescados y Mariscos', 'marisco': 'Pescados y Mariscos',
    'lácteo': 'Lácteos y Huevos', 'queso': 'Lácteos y Huevos',
    'leche': 'Lácteos y Huevos', 'yogur': 'Lácteos y Huevos', 'huevo': 'Lácteos y Huevos',
    'fruta': 'Frutas',
    'verdura': 'Verduras y Hortalizas', 'hortaliza': 'Verduras y Hortalizas',
    'cereal': 'Cereales y Derivados', 'pan': 'Cereales y Derivados',
    'pasta': 'Cereales y Derivados', 'arroz': 'Cereales y Derivados',
    'legumbre': 'Legumbres', 'lentejas': 'Legumbres', 'garbanzos': 'Legumbres',
    'aceite': 'Grasas y Aceites', 'mantequilla': 'Grasas y Aceites',
    'fruto seco': 'Frutos Secos', 'nuez': 'Frutos Secos', 'almendra': 'Frutos Secos',
    'bebida': 'Bebidas', 'agua': 'Bebidas', 'zumo': 'Bebidas',
    'refr': 'Bebidas', 'cerveza': 'Bebidas', 'vino': 'Bebidas',
    'snack': 'Snacks y Aperitivos', 'aperitivo': 'Snacks y Aperitivos', 'patata': 'Snacks y Aperitivos',
    'dulce': 'Dulces y Repostería', 'chocolate': 'Dulces y Repostería',
    'galleta': 'Dulces y Repostería', 'caramelo': 'Dulces y Repostería',
    'condimento': 'Condimentos y Salsas', 'salsa': 'Condimentos y Salsas',
    'especias': 'Condimentos y Salsas', 'sal ': 'Condimentos y Salsas',
    'plato preparado': 'Platos Preparados', 'comida preparada': 'Platos Preparados',
    'suplemento': 'Suplementos', 'vitamina': 'Suplementos',
}

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/91.0 Safari/537.36',
]

# ── Utilidades ─────────────────────────────────────────────────────────────

def ua():
    return {'User-Agent': random.choice(USER_AGENTS)}

def esperar():
    delay = DELAY_BASE + random.uniform(1, 3)
    print(f"    [WAIT] {delay:.1f}s...", end='', flush=True)
    time.sleep(delay)
    print(" ok")

def normalizar_categoria(nombre_api):
    if not nombre_api:
        return 'Otros'
    limpio = str(nombre_api).strip().lower()
    for cat in CATEGORIAS_VALIDAS:
        if cat.lower() == limpio:
            return cat
    for palabra, cat in PALABRAS_CATEGORIA.items():
        if palabra in limpio:
            return cat
    return 'Otros'

def limpiar_html(texto):
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', '', texto)
    for ent, char in [('&aacute;','á'),('&eacute;','é'),('&iacute;','í'),
                      ('&oacute;','ó'),('&uacute;','ú'),('&ntilde;','ñ')]:
        texto = texto.replace(ent, char)
    return texto.strip()

def procesar_ingredientes(texto):
    """Divide texto de ingredientes en lista limpia respetando paréntesis."""
    if not texto:
        return []
    # Balancear paréntesis
    for _ in range(abs(texto.count('(') - texto.count(')'))):
        if texto.count(')') > texto.count('('):
            idx = texto.find(')')
            texto = texto[:idx] + texto[idx+1:]
        else:
            idx = texto.rfind('(')
            texto = texto[:idx] + texto[idx+1:]

    # Dividir por coma/punto/punto y coma fuera de paréntesis
    partes, actual, nivel = [], [], 0
    for ch in texto:
        if ch == '(':
            nivel += 1; actual.append(ch)
        elif ch == ')':
            nivel -= 1; actual.append(ch)
        elif ch in (',', '.', ';') and nivel == 0:
            p = ''.join(actual).strip()
            if p: partes.append(p)
            actual = []
        else:
            actual.append(ch)
    if actual:
        p = ''.join(actual).strip()
        if p: partes.append(p)

    ingredientes = []
    for parte in partes:
        # Eliminar contenido entre paréntesis
        limpio = parte
        for _ in range(10):
            nuevo = re.sub(r'\([^()]*\)', '', limpio)
            if nuevo == limpio: break
            limpio = nuevo
        limpio = re.sub(r'\s+', ' ', limpio).strip()
        limpio = re.sub(r'^[)\]]+\s*', '', limpio)
        limpio = re.sub(r'\s*\d+[.,]\d*%\s*', ' ', limpio).strip()

        # Si tiene ":", quedarse con el lado útil
        if ':' in limpio:
            izq, der = limpio.split(':', 1)
            der = der.strip()
            if re.search(r'E-?\d+|vitamina|ácido', der, re.I):
                limpio = der
            elif re.search(r'estabilizador|colorante|conservante|emulgente', izq, re.I):
                limpio = der or izq.strip()

        # Expandir "X y Y"
        if ' y ' in limpio.lower():
            for sub in re.split(r'\s+y\s+', limpio, flags=re.I):
                sub = sub.strip()
                if ':' in sub:
                    i, d = sub.split(':', 1)
                    sub = d.strip() or i.strip()
                sub = re.sub(r'\s+', ' ', sub).strip()
                if len(sub) > 2 and not re.search(r'origen|fabricad', sub, re.I):
                    ingredientes.append(sub)
            continue

        limpio = re.sub(r'\s+', ' ', limpio).strip()
        if len(limpio) > 2 and not re.search(r'origen|fabricad', limpio, re.I):
            ingredientes.append(limpio)

    return ingredientes

def limpiar_nombre(nombre, marca):
    if not nombre or not marca or marca == 'Sin marca':
        return nombre
    for palabra in marca.split():
        nombre = re.sub(rf'\b{re.escape(palabra)}\b', '', nombre, flags=re.I)
    return ' '.join(nombre.split()).strip() or nombre

# ── Fallos y Procesados ────────────────────────────────────────────────────

def cargar_fallos():
    """Devuelve el dict de fallos y el set de product_ids ya fallados."""
    if FALLOS_FILE.exists():
        try:
            data = json.loads(FALLOS_FILE.read_text(encoding='utf-8'))
            ids_fallados = {str(f['product_id']) for f in data.get('fallos', [])}
            return data, ids_fallados
        except Exception:
            pass
    return {'fallos': []}, set()

def agregar_fallo(data_fallos, product_id, nombre, motivo):
    """Añade un fallo al dict y persiste en disco (append, no sobreescribe)."""
    data_fallos['fallos'].append({
        'product_id': str(product_id),
        'nombre': nombre,
        'motivo': motivo,
        'timestamp': datetime.now().isoformat()
    })
    FALLOS_FILE.write_text(json.dumps(data_fallos, indent=2, ensure_ascii=False), encoding='utf-8')

def cargar_procesados():
    """Devuelve el set de product_ids ya guardados con éxito."""
    if PROCESADOS_FILE.exists():
        try:
            data = json.loads(PROCESADOS_FILE.read_text(encoding='utf-8'))
            return set(str(p) for p in data.get('ids', []))
        except Exception:
            pass
    return set()

def marcar_procesado(product_id, ids_procesados):
    """Añade el product_id al fichero de procesados."""
    ids_procesados.add(str(product_id))
    PROCESADOS_FILE.write_text(
        json.dumps({'ids': sorted(ids_procesados)}, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )

# ── API Mercadona ───────────────────────────────────────────────────────────

def descargar_sitemap():
    print("[*] Descargando sitemap...")
    try:
        resp = requests.get(SITEMAP_URL, timeout=15, headers=ua())
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        ids = []
        for url_elem in root.findall('s:url', ns):
            loc = url_elem.find('s:loc', ns)
            if loc is not None and '/product/' in loc.text:
                m = re.search(r'/product/(\d+)/', loc.text)
                if m:
                    ids.append(m.group(1))
        print(f"[OK] {len(ids)} productos en sitemap")
        return ids
    except Exception as e:
        print(f"[ERROR] Sitemap: {e}")
        return []

def obtener_datos_api(product_id):
    try:
        resp = requests.get(API_URL.format(id=product_id), timeout=15, headers=ua())
        resp.raise_for_status()
        data = resp.json()
        nombre = data.get('slug', '').replace('-', ' ').title()
        marca  = data.get('brand', 'Sin marca')
        ean    = data.get('ean', '')
        photos = data.get('photos', [])
        imgs = []
        if len(photos) > 1: imgs.append(photos[1].get('regular', ''))
        if len(photos) > 0: imgs.append(photos[0].get('regular', ''))
        return {'id': product_id, 'nombre': nombre, 'marca': marca,
                'ean': ean, 'imagen_urls': imgs, 'raw': data}
    except Exception as e:
        print(f"    [ERROR] API: {e}")
        return None

def ean_en_bd(ean):
    if not ean:
        return False
    with app.app_context():
        return Alimento.query.filter_by(codigo_barras=ean).first() is not None

def descargar_imagen(url):
    try:
        resp = requests.get(url, timeout=15, headers=ua())
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None

# ── Procesado ──────────────────────────────────────────────────────────────

def procesar_producto(datos_api):
    raw  = datos_api['raw']
    nombre = limpiar_nombre(raw.get('display_name', datos_api['nombre']), datos_api['marca'])
    marca  = datos_api['marca']
    ean    = datos_api['ean']

    # Categoría
    cat_api = None
    cats = raw.get('categories', [])
    if isinstance(cats, list) and cats:
        cat_api = cats[-1].get('name') if isinstance(cats[-1], dict) else str(cats[-1])
    elif isinstance(raw.get('category'), dict):
        cat_api = raw['category'].get('name')
    categoria = normalizar_categoria(cat_api)

    # Ingredientes del API
    nutr = raw.get('nutrition_information', {})
    ingredientes = []
    if isinstance(nutr, dict):
        ing_txt = limpiar_html(nutr.get('ingredients', ''))
        if ing_txt:
            ingredientes = procesar_ingredientes(ing_txt)

    # Macros: OCR primero, fallback al API
    macros = None
    for idx, url in enumerate(datos_api['imagen_urls'], 1):
        print(f"    Imagen [{idx}] OCR...", end=' ', flush=True)
        img = descargar_imagen(url)
        if not img:
            print("sin imagen")
            continue
        try:
            res = procesar_datos_completos(img, 'image/jpeg')
            if res:
                m = res.get('macros', {})
                if all(m.get(k) is not None for k in ('calorias', 'proteinas', 'grasas', 'hidratos_carbono')):
                    print(f"ok ({m['calorias']} kcal)")
                    macros = m
                    break
                else:
                    print("macros incompletas")
        except Exception as e:
            print(f"error: {e}")

    if not macros and isinstance(nutr, dict):
        print("    [FALLBACK] macros del API...", end=' ')
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
            print(f"ok ({kcal} kcal)")
        else:
            print("sin macros")

    if not macros:
        return None

    return {'nombre': nombre, 'marca': marca, 'ean': ean,
            'ingredientes': ingredientes, 'macros': macros, 'categoria': categoria}

def guardar_en_bd(datos):
    with app.app_context():
        try:
            alimento = Alimento(
                nombre=datos['nombre'],
                marca=datos.get('marca', 'Sin marca'),
                codigo_barras=datos.get('ean'),
                categoria=datos.get('categoria', 'Otros'),
                calorias=datos['macros'].get('calorias'),
                proteinas=datos['macros'].get('proteinas'),
                grasas=datos['macros'].get('grasas'),
                grasas_saturadas=datos['macros'].get('grasas_saturadas'),
                hidratos_carbono=datos['macros'].get('hidratos_carbono'),
                azucares=datos['macros'].get('azucares'),
                fibra=datos['macros'].get('fibra'),
                sal=datos['macros'].get('sal'),
            )
            vistos = set()
            for ing_nombre in datos.get('ingredientes', []):
                ing_nombre = ing_nombre.strip()
                if not ing_nombre or ing_nombre.lower() in vistos:
                    continue
                vistos.add(ing_nombre.lower())
                ing = Ingrediente.query.filter(
                    db.func.lower(Ingrediente.nombre) == ing_nombre.lower()
                ).first()
                if not ing:
                    ing = Ingrediente(nombre=ing_nombre, verificado=False)
                    db.session.add(ing)
                    db.session.flush()
                alimento.ingredientes.append(ing)
            db.session.add(alimento)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"    [ERROR] BD: {e}")
            return False

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=30, help='Número de productos a procesar')
    args = parser.parse_args()
    MAX = args.n

    print("=" * 60)
    print(f"[INICIO] Scraper continuo — objetivo: {MAX} productos nuevos")
    print("=" * 60)

    # Cargar fallos y procesados previos (para saltarlos sin tocar la API)
    data_fallos, ids_fallados = cargar_fallos()
    ids_procesados = cargar_procesados()
    ids_skip = ids_fallados | ids_procesados
    print(f"[INFO] {len(ids_fallados)} ya fallados + {len(ids_procesados)} ya guardados = {len(ids_skip)} a saltar")

    # Sitemap → filtrar ya procesados y fallados
    todos_ids = descargar_sitemap()
    candidatos = [pid for pid in todos_ids if pid not in ids_skip]
    print(f"[INFO] {len(candidatos)} candidatos tras filtrar\n")

    contadores = {'procesados': 0, 'guardados': 0, 'saltados_bd': 0,
                  'sin_macros': 0, 'error_api': 0, 'error_bd': 0}
    nuevos_fallos = 0

    for pid in candidatos:
        if contadores['guardados'] >= MAX:
            break

        print(f"[ID {pid}]", end=" ")

        # Obtener datos API
        datos_api = obtener_datos_api(pid)
        if not datos_api:
            print("[SKIP] error API")
            contadores['error_api'] += 1
            agregar_fallo(data_fallos, pid, 'desconocido', 'Error llamada API')
            nuevos_fallos += 1
            esperar()
            continue

        nombre = datos_api['nombre']

        # ¿Ya está en BD? (salvaguarda para primeras ejecuciones sin procesados.json)
        if ean_en_bd(datos_api['ean']):
            print(f"[SKIP] ya en BD ({datos_api['ean']}) — añadiendo a procesados")
            contadores['saltados_bd'] += 1
            marcar_procesado(pid, ids_procesados)
            esperar()
            continue

        print(f"-> {nombre[:45]}")
        contadores['procesados'] += 1

        datos = procesar_producto(datos_api)
        if not datos:
            print(f"    [FALLO] Sin macros — anotado en fallos")
            contadores['sin_macros'] += 1
            agregar_fallo(data_fallos, pid, nombre, 'Sin macros (OCR y API)')
            nuevos_fallos += 1
            esperar()
            continue

        if guardar_en_bd(datos):
            print(f"    [OK] Guardado en BD")
            contadores['guardados'] += 1
            marcar_procesado(pid, ids_procesados)
        else:
            print(f"    [FALLO] Error al guardar en BD")
            contadores['error_bd'] += 1
            agregar_fallo(data_fallos, pid, nombre, 'Error al guardar en BD')
            nuevos_fallos += 1

        esperar()

    print("\n" + "=" * 60)
    print("[RESUMEN]")
    print("=" * 60)
    print(f"Guardados en BD:      {contadores['guardados']}")
    print(f"Saltados (ya en BD):  {contadores['saltados_bd']}")
    print(f"Sin macros:           {contadores['sin_macros']}")
    print(f"Errores API:          {contadores['error_api']}")
    print(f"Errores BD:           {contadores['error_bd']}")
    print(f"Nuevos fallos añad.:  {nuevos_fallos}")
    print(f"Total fallos acum.:   {len(data_fallos['fallos'])}")
    print("=" * 60)

    if contadores['guardados'] > 0:
        print("\n[AUTO] Clasificando ingredientes nuevos con Claude...")
        clasificador = Path(__file__).parent / 'clasificar_ingredientes.py'
        import subprocess
        subprocess.run([sys.executable, str(clasificador)], check=False)

if __name__ == '__main__':
    main()
