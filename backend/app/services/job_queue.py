"""
Sistema de colas para procesar OCR de forma asíncrona.
Mantiene el estado de los jobs y permite notificar al frontend cuando estén listos.
"""

import uuid
from datetime import datetime
from typing import Dict, Any, Callable

# Almacenar jobs en memoria (en producción usarías Redis o una BD)
_jobs: Dict[str, Dict[str, Any]] = {}
_listeners: Dict[str, list[Callable]] = {}


class JobStatus:
    """Estados posibles de un job"""
    PENDIENTE = "pendiente"
    PROCESANDO = "procesando"
    LISTO = "listo"
    ERROR = "error"


def crear_job(tipo: str, datos: Dict[str, Any]) -> str:
    """
    Crea un nuevo job y retorna el ID.
    Tipos válidos: 'ocr_ingredientes', 'ocr_macros', 'ocr_codigo'
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        'id': job_id,
        'tipo': tipo,
        'estado': JobStatus.PENDIENTE,
        'datos': datos,
        'resultado': None,
        'error': None,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    return job_id


def obtener_job(job_id: str) -> Dict[str, Any] | None:
    """Obtiene el estado de un job por ID"""
    return _jobs.get(job_id)


def actualizar_job(job_id: str, estado: str, resultado: Any = None, error: str = None):
    """Actualiza el estado y resultado de un job"""
    if job_id not in _jobs:
        return

    job = _jobs[job_id]
    job['estado'] = estado
    job['updated_at'] = datetime.utcnow().isoformat()

    if resultado is not None:
        job['resultado'] = resultado

    if error is not None:
        job['error'] = error

    # Notificar a todos los listeners del job
    if job_id in _listeners:
        for callback in _listeners[job_id]:
            try:
                callback(job)
            except Exception:
                pass


def suscribirse_a_job(job_id: str, callback: Callable):
    """
    Se suscribe a cambios de estado de un job.
    El callback se llamará con el estado actualizado del job.
    """
    if job_id not in _listeners:
        _listeners[job_id] = []
    _listeners[job_id].append(callback)


def limpiar_job(job_id: str):
    """Elimina un job completado"""
    if job_id in _jobs:
        del _jobs[job_id]
    if job_id in _listeners:
        del _listeners[job_id]
