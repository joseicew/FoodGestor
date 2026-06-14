from app import db
from datetime import datetime
import json


# Categorías de alérgenos/intolerancias disponibles
ALERGENO_CATEGORIAS = [
    'Lácteos',
    'Gluten',
    'Frutos secos',
    'Fruta',
    'Verdura',
    'Marisco',
    'Huevo',
    'Soja',
    'Pescado',
    'Moluscos'
]

# Categorías de alimentos (grupos de alimentos)
ALIMENTOS_CATEGORIAS = [
    'Cereales y derivados',
    'Legumbres',
    'Frutas',
    'Frutos secos',
    'Verduras',
    'Carnes',
    'Pescados y mariscos',
    'Lácteos',
    'Huevos',
    'Grasas y aceites',
    'Azúcares y dulces',
    'Bebidas',
    'Condimentos y especias',
    'Aditivos'
]


class Ingrediente(db.Model):
    __tablename__ = 'ingrediente'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False, unique=True)
    categoria = db.Column(db.String(100), default='')  # "cereal", "legumbre", "fruta", "marisco", etc
    es_aditivo = db.Column(db.Boolean, default=False)  # True si es un aditivo (E102, colorante, etc)
    notas = db.Column(db.Text, default='')  # Descripción/explicación del ingrediente
    alergenos_categorias = db.Column(db.Text, default='[]')  # JSON array de categorías alérgenas
    verificado = db.Column(db.Boolean, default=False)  # True si ya ha sido revisado
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_alergenos_categorias(self):
        """Obtiene la lista de categorías alérgenas como array de strings"""
        try:
            return json.loads(self.alergenos_categorias) if self.alergenos_categorias else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_alergenos_categorias(self, categorias):
        """Establece las categorías alérgenas desde un array"""
        if isinstance(categorias, list):
            self.alergenos_categorias = json.dumps(categorias)
        else:
            self.alergenos_categorias = '[]'

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'categoria': self.categoria,
            'es_aditivo': self.es_aditivo,
            'notas': self.notas,
            'alergenos_categorias': self.get_alergenos_categorias(),
            'verificado': self.verificado,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
