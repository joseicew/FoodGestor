"""
Utilidades compartidas para mantener limpia la tabla `ingrediente` en el
momento en que se crea o desvincula un ingrediente, en vez de depender
solo de las limpiezas manuales/periodicas del panel de administracion.

- `obtener_o_crear_ingrediente`: evita duplicados por may/minusculas o
  espacios en el momento de crear (mismo criterio que la limpieza de
  duplicados: nombre.lower().strip()).
- `limpiar_huerfanos_por_ids`: tras desvincular ingredientes de un
  alimento (p.ej. al editar su lista), borra los que se hayan quedado
  sin ningun alimento asociado, sin esperar a la limpieza periodica.
"""
from sqlalchemy import exists
from app import db
from app.models.ingrediente import Ingrediente
from app.models.alimento import alimento_ingrediente


def obtener_o_crear_ingrediente(nombre, capitalizar=False, **campos):
    """
    Devuelve el ingrediente existente que coincide con `nombre`
    (case-insensitive, sin espacios sobrantes) o crea uno nuevo si no
    existe ninguno. `campos` solo se aplica al crear uno nuevo.
    `capitalizar=True` pone en mayúscula la primera letra del nombre
    nuevo (solo si se crea; no afecta a uno ya existente).
    """
    nombre_normalizado = (nombre or '').strip()
    if not nombre_normalizado:
        return None

    existente = Ingrediente.query.filter(
        db.func.lower(Ingrediente.nombre) == nombre_normalizado.lower()
    ).first()
    if existente:
        return existente

    nombre_final = nombre_normalizado.capitalize() if capitalizar else nombre_normalizado
    nuevo = Ingrediente(nombre=nombre_final, **campos)
    db.session.add(nuevo)
    db.session.flush()
    return nuevo


def limpiar_huerfanos_por_ids(ingrediente_ids):
    """
    De la lista de ids dada, borra los que ya no tengan ningun alimento
    asociado. Pensado para llamarse justo despues de desvincular
    ingredientes de un alimento (p.ej. al reemplazar su lista), para que
    los huerfanos no se acumulen hasta la siguiente limpieza manual.
    """
    ids = [i for i in set(ingrediente_ids) if i is not None]
    if not ids:
        return 0

    tiene_alimento = exists().where(alimento_ingrediente.c.ingrediente_id == Ingrediente.id)
    huerfanos = Ingrediente.query.filter(Ingrediente.id.in_(ids), ~tiene_alimento).all()
    if not huerfanos:
        return 0

    huerfanos_ids = [h.id for h in huerfanos]
    Ingrediente.query.filter(Ingrediente.id.in_(huerfanos_ids)).delete(synchronize_session=False)
    return len(huerfanos_ids)
