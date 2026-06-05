from app import db
from datetime import datetime


class Alergeno(db.Model):
    __tablename__ = 'alergeno'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    codigo_allergen = db.Column(db.String(50), nullable=True)  # Ej: "en:soybeans"
    es_aditivo = db.Column(db.Boolean, default=False)  # True si es aditivo (E102, E110, etc)
    categoria = db.Column(db.String(100), nullable=True)  # "fruto seco", "cereal", "aditivo", "lácteo", etc
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'codigo_allergen': self.codigo_allergen,
            'es_aditivo': self.es_aditivo,
            'categoria': self.categoria,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
