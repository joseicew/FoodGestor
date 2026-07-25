"""
Reclasifica los alimentos que quedaron en la categoria 'Otros'.

El scraper metio en 'Otros' casi todo lo que era congelado, conserva o
preparado, porque no encajaba en su taxonomia de origen. Se nota en que
'Verduras y Hortalizas' tiene 2 alimentos en toda la BD mientras que en
'Otros' hay mas de cien verduras ultracongeladas, y en que Legumbres,
Frutos Secos y Suplementos estan a cero.

Uso:
    python -m scripts.reclasificar_otros            # genera CSV de propuesta
    python -m scripts.reclasificar_otros --aplicar  # aplica el CSV revisado

El flujo es en dos pasos a proposito: la clasificacion por palabras clave
acierta ~87%, asi que el CSV se revisa a mano antes de tocar la BD. Al
aplicar solo se leen las filas cuya columna 'aprobado' es 1, de modo que
descartar una propuesta es tan simple como poner un 0.
"""
import argparse
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db  # noqa: E402
from app.models.alimento import Alimento  # noqa: E402

CSV_POR_DEFECTO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reclasificacion_otros.csv')


def _kw(*palabras):
    """Palabras clave tolerando el plural castellano (-s / -es)."""
    return r'\b(' + '|'.join(palabras) + r')(es|s)?\b'


# El orden importa: gana la primera regla que casa.
#
# 'Platos Preparados' va PRIMERO a proposito. Un plato compuesto debe
# clasificarse por el plato, no por uno de sus ingredientes: sin esta
# prioridad "Pizza 4 quesos" caia en Lacteos, "Lasaña de atun" en Pescados
# y "Tortilla de patata" en Verduras.
REGLAS = [
    ('Platos Preparados', _kw(
        'pizza', 'lasa[ñn]a', 'canel[oó]n', 'empanada', 'empanadilla', 'croqueta',
        'san jacobo', 'nugget', 'varita', 'ensaladilla', 'ensalada', 'paella',
        'fideu[aá]', 'sushi', 'falafel', 'tofu', 'seit[aá]n', 'heura', 'burger',
        'tortilla', 'wrap', 'sandwich', 's[aá]ndwich', 'rosca', 'bocadillo',
        'sopa', 'crema', 'caldo', 'pur[eé]', 'papilla', 'bolsita', 'gazpacho',
        'salmorejo', 'pisto', 'menestra', 'salteado', 'revuelto', 'guiso',
        'cocido', 'fabada', 'potaje', 'callo', 'albóndiga', 'rollito', 'tempura',
        'tabul[eé]', 'migas', 'chucrut', 'tsatsiki', 'hummus', 'h[uu]mmus',
        'guacamole', 'mac & cheese', 'carbonara', 'boloñesa', 'finger',
    )),
    ('Bebidas', _kw(
        'caf[eé]', 'cacao', 'colacao', 'infusi[oó]n', 't[eé] negro', 't[eé] verde',
        't[eé] chai', 't[eé] matcha', 'rooibos', 'refresco', 'bebida', 'zumo',
        'n[eé]ctar', 'batido', 'cerveza', 'vino', 'sidra', 'cider', 'agua',
        'horchata', 'mosto', 'smoothie', 't[oó]nica', 'limonada', 'cortado',
        'capuchino', 'cappuccino', 'frizzante', 'sangr[ií]a', 'tinto de verano',
        'cocktail', 'c[oó]ctel', 'malta', 'achicoria', 'licor', 'granizado',
    )),
    ('Pescados y Mariscos', _kw(
        'at[uú]n', 'bonito', 'sardina', 'sardinilla', 'caballa', 'melva', 'anchoa',
        'boquer[oó]n', 'mejill[oó]n', 'berberecho', 'almeja', 'almej[oó]n',
        'calamar', 'chipir[oó]n', 'pulpo', 'pota', 'gamba', 'langostino',
        'merluza', 'bacalao', 'salm[oó]n', 'marisco', 'surimi', 'sepia', 'navaja',
        'zamburi[ñn]a', 'trucha', 'lubina', 'dorada', 'panga', 'tilapia', 'rape',
        'emperador', 'pez espada', 'palito de mar',
    )),
    ('Carnes y Aves', _kw(
        'pollo', 'pavo', 'cerdo', 'ternera', 'vacuno', 'buey', 'cordero', 'lechal',
        'conejo', 'pato', 'jam[oó]n', 'chorizo', 'salchich[oó]n', 'lomo', 'bacon',
        'panceta', 'morcilla', 'salchicha', 'hamburguesa', 'carne', 'solomillo',
        'secreto', 'costilla', 'chuleta', 'filete', 'alita', 'magro', 'fuet',
        'salami', 'mortadela', 'sobrasada', 'butifarra', 'longaniza', 'carrillada',
        'paletilla', 'muslo', 'pechuga', 'ala de',
    )),
    # Cereales antes que Verduras: en "Arroz con verduras" el alimento es el
    # arroz y la verdura es el acompañamiento, no al reves.
    ('Cereales y Derivados', _kw(
        'arroz', 'pasta', 'macarr[oó]n', 'espagueti', 'spaghetti', 'fideo',
        'tallarin', 'noodle', 'pan', 'panecillo', 'harina', 'avena', 'cereal',
        'muesli', 'granola', 'tostada', 'biscote', 'masa', 'base de pizza',
        'cusc[uú]s', 'quinoa', 's[eé]mola', 'salvado', 'focaccia',
    )),
    ('Verduras y Hortalizas', _kw(
        'acelga', 'espinaca', 'br[oó]coli', 'coliflor', 'alcachofa', 'guisante',
        'zanahoria', 'calabac[ií]n', 'calabaza', 'berenjena', 'pimiento', 'cebolla',
        'ajo', 'puerro', 'tomate', 'lechuga', 'escarola', 'canónigo', 'r[uú]cula',
        'pepino', 'apio', 'esp[aá]rrago', 'champi[ñn][oó]n', 'seta', 'patata',
        'batata', 'boniato', 'remolacha', 'nabo', 'repollo', 'col de bruselas',
        'coles de bruselas', 'verdura', 'hortaliza', 'germinado', 'brote',
        'jud[ií]a verde', 'jud[ií]a', 'garrof[oó]n', 'mazorquita', 'palmito',
        'ma[ií]z dulce', 'bast[oó]n de',
    )),
    ('Frutas', _kw(
        'manzana', 'pera', 'pl[aá]tano', 'banana', 'naranja', 'mandarina',
        'lim[oó]n', 'fresa', 'fres[oó]n', 'ar[aá]ndano', 'frambuesa', 'mora',
        'cereza', 'uva', 'mel[oó]n', 'sand[ií]a', 'pi[ñn]a', 'mango', 'papaya',
        'kiwi', 'melocot[oó]n', 'nectarina', 'albaricoque', 'ciruela', 'higo',
        'granada', 'caqui', 'aguacate', 'coco', 'd[aá]til', 'pasa', 'fruta',
        'macedonia', 'frutos rojos',
    )),
    ('Legumbres', _kw(
        'alubia', 'jud[ií]a blanca', 'jud[ií]a pinta', 'garbanzo', 'lenteja',
        'soja', 'edamame', 'haba', 'habita', 'frijol',
    )),
    ('Frutos Secos', _kw(
        'almendra', 'nuez', 'nueces', 'avellana', 'pistacho', 'anacardo',
        'cacahuete', 'pipa', 'semilla', 's[eé]samo', 'ch[ií]a', 'lino', 'piñón',
    )),
    ('Dulces y Repostería', _kw(
        'helado', 'chocolate', 'bomb[oó]n', 'galleta', 'bizcocho', 'magdalena',
        'croissant', 'donut', 'tarta', 'pastel', 'caramelo', 'chicle', 'gominola',
        'turr[oó]n', 'mermelada', 'miel', 'az[uú]car', 'gofre', 'churro', 'porra',
        'mousse', 'natilla', 'flan', 'postre', 'pud[ií]n', 'roscón', 'polvorón',
        'mantecado', 'dulce de membrillo', 'cabello de [aá]ngel', 'crepe',
    )),
    ('Lácteos y Huevos', _kw(
        'leche', 'yogur', 'queso', 'nata', 'mantequilla', 'cuajada', 'k[eé]fir',
        'kefir', 'requesón', 'mascarpone', 'huevo', 'petit',
    )),
    ('Snacks y Aperitivos', _kw(
        'patatas fritas', 'snack', 'aperitivo', 'nacho', 'palomita', 'cortez[ao]',
        'gusanito', 'tortita', 'kikos', 'encurtido', 'aceituna', 'banderilla',
    )),
    ('Condimentos y Salsas', _kw(
        'salsa', 'ketchup', 'mayonesa', 'mostaza', 'vinagre', 'especia',
        'or[eé]gano', 'pimienta', 'sofrito', 'ali[oñ]', 'pesto', 'pat[eé]',
        'sazonador', 'colorante', 'levadura', 'gelatina',
    )),
    ('Grasas y Aceites', _kw('aceite', 'margarina', 'manteca')),
]

COMPILADAS = [(cat, re.compile(rx, re.IGNORECASE)) for cat, rx in REGLAS]


def _sin_descriptores(nombre):
    """Quita el 'sabor X' final: describe el sabor, no el tipo de alimento.

    Sin esto "Helado bombon pistacho sabor almendra" cae en Frutos Secos y
    "Helado sandwich sabor nata" en Lacteos, cuando ambos son Dulces.
    """
    return re.split(
        r'\bsabor\b|\bcon salsa de\b|\brelleno de\b|\bal estilo\b',
        nombre, flags=re.IGNORECASE
    )[0].strip()


def clasificar(nombre):
    """Devuelve la categoria propuesta, o None si no hay patron claro."""
    base = _sin_descriptores(nombre)
    # El sustantivo principal (primeras palabras) pesa mas que el resto:
    # en "Croquetas de cocido" manda "Croquetas", no "cocido".
    cabeza = ' '.join(base.split()[:3])
    for cat, rx in COMPILADAS:
        if rx.search(cabeza):
            return cat
    for cat, rx in COMPILADAS:
        if rx.search(base):
            return cat
    return None


def generar_csv(ruta):
    app = create_app()
    with app.app_context():
        otros = Alimento.query.filter_by(categoria='Otros').order_by(Alimento.nombre).all()

        filas, sin_patron = [], []
        for a in otros:
            propuesta = clasificar(a.nombre)
            if propuesta:
                filas.append({
                    'id': a.id,
                    'nombre': a.nombre,
                    'marca': a.marca or '',
                    'categoria_propuesta': propuesta,
                    'aprobado': 1,
                })
            else:
                sin_patron.append(a.nombre)

    with open(ruta, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, fieldnames=['id', 'nombre', 'marca', 'categoria_propuesta', 'aprobado'])
        w.writeheader()
        w.writerows(sorted(filas, key=lambda f: (f['categoria_propuesta'], f['nombre'])))

    print(f'{len(otros)} alimentos en "Otros"')
    print(f'  {len(filas)} con propuesta -> {ruta}')
    print(f'  {len(sin_patron)} sin patron, se quedan en "Otros"')
    resumen = {}
    for f in filas:
        resumen[f['categoria_propuesta']] = resumen.get(f['categoria_propuesta'], 0) + 1
    print()
    for cat, n in sorted(resumen.items(), key=lambda kv: -kv[1]):
        print(f'  {n:4d} -> {cat}')
    if sin_patron:
        print()
        print('Sin patron:')
        for n in sin_patron:
            print('   -', n)
    print()
    print('Revisa el CSV y pon 0 en "aprobado" para descartar filas.')
    print('Despues:  python -m scripts.reclasificar_otros --aplicar')


def aplicar_csv(ruta):
    if not os.path.exists(ruta):
        print(f'No existe {ruta}. Genera primero la propuesta.')
        return 1

    with open(ruta, newline='', encoding='utf-8-sig') as fh:
        filas = [r for r in csv.DictReader(fh) if str(r.get('aprobado', '')).strip() == '1']

    if not filas:
        print('No hay filas aprobadas (columna "aprobado" = 1). No se ha tocado nada.')
        return 0

    app = create_app()
    with app.app_context():
        cambiados, omitidos = 0, 0
        for r in filas:
            a = Alimento.query.get(int(r['id']))
            # Solo se mueve lo que sigue en 'Otros': si alguien ya lo recategorizo
            # a mano entre la generacion del CSV y ahora, se respeta.
            if a is None or a.categoria != 'Otros':
                omitidos += 1
                continue
            a.categoria = r['categoria_propuesta']
            cambiados += 1
        db.session.commit()

        restantes = Alimento.query.filter_by(categoria='Otros').count()

    print(f'{cambiados} alimentos reclasificados, {omitidos} omitidos (ya no estaban en "Otros")')
    print(f'Quedan {restantes} en "Otros"')
    return 0


def main():
    p = argparse.ArgumentParser(description='Reclasifica los alimentos de la categoria "Otros".')
    p.add_argument('--aplicar', action='store_true', help='Aplica el CSV revisado a la base de datos')
    p.add_argument('--csv', default=CSV_POR_DEFECTO, help='Ruta del CSV de propuesta')
    args = p.parse_args()
    return aplicar_csv(args.csv) if args.aplicar else (generar_csv(args.csv) or 0)


if __name__ == '__main__':
    sys.exit(main())
