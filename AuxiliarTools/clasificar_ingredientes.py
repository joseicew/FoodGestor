#!/usr/bin/env python3
"""
Clasifica los ingredientes pendientes de la BD usando Claude AI.
Para cada ingrediente determina:
  - categoria        (de ALIMENTOS_CATEGORIAS)
  - alergenos_categorias (de ALERGENO_CATEGORIAS)
  - es_aditivo       (bool)
  - verificado       -> True tras clasificar

Uso:
    python clasificar_ingredientes.py           # procesa los no verificados (lotes de 50)
    python clasificar_ingredientes.py --n 100   # limita a 100 ingredientes
    python clasificar_ingredientes.py --todos   # reprocesa tambien los ya verificados
    python clasificar_ingredientes.py --stats   # solo muestra estadisticas, no modifica nada
"""

import os, sys, json, argparse, time, re
from pathlib import Path

# ── Entorno ─────────────────────────────────────────────────────────────────
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
env_path = os.path.join(basedir, '.env')
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path)

sys.path.insert(0, basedir)
from app import create_app, db
from app.models.ingrediente import Ingrediente, ALERGENO_CATEGORIAS, ALIMENTOS_CATEGORIAS

import anthropic

app = create_app()

# ── Config ───────────────────────────────────────────────────────────────────
BATCH_SIZE  = 50
MODEL       = "claude-haiku-4-5-20251001"
MAX_TOKENS  = 8192
DELAY_LOTE  = 0.5   # segundos entre lotes (para no saturar la API)

SYSTEM_PROMPT = f"""Eres un experto en nutricion y etiquetado de alimentos europeo (normativa EU).
Se te dara una lista JSON de nombres de ingredientes alimentarios en espanol.
Para cada uno debes clasificarlo con precision.

CATEGORIAS DE ALIMENTO (elige exactamente una, o null si no encaja):
{json.dumps(ALIMENTOS_CATEGORIAS, ensure_ascii=False)}

CATEGORIAS DE ALERGENOS/INTOLERANCIAS (elige todas las que apliquen):
{json.dumps(ALERGENO_CATEGORIAS, ensure_ascii=False)}

Devuelve SOLO un array JSON con un objeto por ingrediente en el mismo orden.
Estructura de cada objeto:
{{
  "nombre": "<nombre exacto tal como se te dio>",
  "categoria": "<categoria de alimento o null>",
  "alergenos_categorias": ["<solo las que apliquen>"],
  "es_aditivo": true|false
}}

Reglas:
- es_aditivo=true para: aditivos E-xxx, colorantes, conservantes, estabilizantes,
  emulsionantes, antioxidantes, acidulantes, potenciadores del sabor, espesantes,
  gelificantes, edulcorantes artificiales, aromas artificiales, etc.
- alergenos_categorias vacia [] si el ingrediente no es un alergeno conocido.
- No incluyas texto ni explicaciones fuera del array JSON.
"""


def extraer_json(texto: str) -> list:
    texto = texto.strip()
    if texto.startswith('['):
        return json.loads(texto)
    m = re.search(r'\[.*\]', texto, re.DOTALL)
    if m:
        return json.loads(m.group())
    raise ValueError(f"Respuesta sin JSON valido: {texto[:300]}")


def clasificar_lote(ingredientes: list, client: anthropic.Anthropic) -> list:
    nombres = [i.nombre for i in ingredientes]
    user_msg = "Clasifica estos ingredientes:\n" + json.dumps(nombres, ensure_ascii=False)

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}]
    )
    return extraer_json(response.content[0].text)


def mostrar_stats():
    with app.app_context():
        total      = db.session.query(Ingrediente).count()
        verificados = db.session.query(Ingrediente).filter(Ingrediente.verificado == True).count()
        aditivos   = db.session.query(Ingrediente).filter(Ingrediente.es_aditivo == True).count()
        sin_cat    = db.session.query(Ingrediente).filter(
            (Ingrediente.categoria == None) | (Ingrediente.categoria == '')
        ).count()

        print(f"\n=== Estado ingredientes ===")
        print(f"  Total:        {total}")
        print(f"  Verificados:  {verificados}  ({100*verificados//total if total else 0}%)")
        print(f"  Pendientes:   {total - verificados}")
        print(f"  Aditivos:     {aditivos}")
        print(f"  Sin categoria:{sin_cat}")

        print(f"\n--- Distribucion por categoria ---")
        from sqlalchemy import func
        rows = (db.session.query(Ingrediente.categoria, func.count())
                .group_by(Ingrediente.categoria)
                .order_by(func.count().desc())
                .all())
        for cat, cnt in rows:
            print(f"  {(cat or '(vacia)'):30s} {cnt}")

        print(f"\n--- Distribucion por alergeno ---")
        from collections import Counter
        todos = db.session.query(Ingrediente.alergenos_categorias).all()
        contador = Counter()
        for (ac,) in todos:
            try:
                for a in json.loads(ac or '[]'):
                    contador[a] += 1
            except Exception:
                pass
        for alerg, cnt in sorted(contador.items(), key=lambda x: -x[1]):
            print(f"  {alerg:20s} {cnt}")


def main():
    parser = argparse.ArgumentParser(description='Clasifica ingredientes con Claude AI')
    parser.add_argument('--n',      type=int, default=None,  help='Max ingredientes a procesar')
    parser.add_argument('--todos',  action='store_true',     help='Reprocesar tambien los ya verificados')
    parser.add_argument('--stats',  action='store_true',     help='Solo mostrar estadisticas')
    args = parser.parse_args()

    if args.stats:
        mostrar_stats()
        return

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("[ERROR] ANTHROPIC_API_KEY no encontrada en .env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    with app.app_context():
        query = db.session.query(Ingrediente)
        if not args.todos:
            query = query.filter(Ingrediente.verificado == False)
        query = query.order_by(Ingrediente.id)

        ingredientes = query.all()
        if args.n:
            ingredientes = ingredientes[:args.n]

        total = len(ingredientes)
        if total == 0:
            print("No hay ingredientes pendientes. Usa --todos para reprocesar todos.")
            mostrar_stats()
            return

        print(f"Ingredientes a clasificar: {total}  (modelo: {MODEL}, lotes: {BATCH_SIZE})")
        print("-" * 80)

        procesados = 0
        errores    = 0

        for i in range(0, total, BATCH_SIZE):
            lote  = ingredientes[i : i + BATCH_SIZE]
            desde = i + 1
            hasta = min(i + len(lote), total)
            print(f"\n[{desde}-{hasta}/{total}] Clasificando lote de {len(lote)}...")

            try:
                resultados = clasificar_lote(lote, client)

                # Mapear por nombre (case-insensitive por si acaso)
                mapa = {r['nombre'].lower(): r for r in resultados}

                for ing in lote:
                    res = mapa.get(ing.nombre.lower())
                    if res is None:
                        # Intentar match exacto
                        res = next((r for r in resultados if r['nombre'] == ing.nombre), None)
                    if res is None:
                        print(f"  [WARN] Sin resultado para: {ing.nombre}")
                        errores += 1
                        continue

                    ing.categoria = res.get('categoria') or ''
                    ing.es_aditivo = bool(res.get('es_aditivo', False))
                    ing.set_alergenos_categorias(res.get('alergenos_categorias', []))
                    ing.verificado = True

                    alerg_str = ', '.join(res.get('alergenos_categorias', [])) or '-'
                    adit_str  = 'ADIT' if ing.es_aditivo else '    '
                    print(f"  {adit_str} {ing.nombre[:38]:38s} | {ing.categoria or 'sin cat':22s} | {alerg_str}")
                    procesados += 1

                db.session.commit()

            except Exception as e:
                db.session.rollback()
                print(f"  [ERROR] Lote fallido: {e}")
                errores += len(lote)

            if i + BATCH_SIZE < total:
                time.sleep(DELAY_LOTE)

        print(f"\n{'='*60}")
        print(f"Procesados: {procesados}  |  Errores: {errores}")
        mostrar_stats()


if __name__ == '__main__':
    main()
