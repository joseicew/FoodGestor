from app import db
from datetime import datetime


alimento_ingrediente = db.Table(
    'alimento_ingrediente',
    db.Column('alimento_id', db.Integer, db.ForeignKey('alimento.id'), primary_key=True),
    db.Column('ingrediente_id', db.Integer, db.ForeignKey('ingrediente.id'), primary_key=True)
)


class Alimento(db.Model):
    __tablename__ = 'alimento'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False, index=True)
    nombre = db.Column(db.String(255), nullable=False)
    marca = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text)
    calorias = db.Column(db.Integer)
    proteinas = db.Column(db.Float)
    grasas = db.Column(db.Float)
    grasas_saturadas = db.Column(db.Float)
    hidratos_carbono = db.Column(db.Float)
    azucares = db.Column(db.Float)
    fibra = db.Column(db.Float)
    sal = db.Column(db.Float)
    sodio = db.Column(db.Float)
    potasio = db.Column(db.Float)
    calcio = db.Column(db.Float)
    hierro = db.Column(db.Float)
    categoria = db.Column(db.String(255))
    codigo_barras = db.Column(db.String(100), unique=True, nullable=True)
    foto_ingredientes = db.Column(db.String(500))
    foto_macros = db.Column(db.String(500))
    peso_unidad = db.Column(db.Float, nullable=True)  # Peso en gramos de una unidad (ej: 150g para 1 manzana)
    nombre_unidad = db.Column(db.String(50), nullable=True)  # Nombre de la unidad (ej: "manzana", "plátano", "vaso")
    favorito = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ingredientes = db.relationship(
        'Ingrediente',
        secondary=alimento_ingrediente,
        backref='alimentos',
        lazy='select'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'marca': self.marca,
            'descripcion': self.descripcion,
            'calorias': self.calorias,
            'proteinas': self.proteinas,
            'grasas': self.grasas,
            'grasas_saturadas': self.grasas_saturadas,
            'hidratos_carbono': self.hidratos_carbono,
            'azucares': self.azucares,
            'fibra': self.fibra,
            'sal': self.sal,
            'sodio': self.sodio,
            'potasio': self.potasio,
            'calcio': self.calcio,
            'hierro': self.hierro,
            'categoria': self.categoria,
            'codigo_barras': self.codigo_barras,
            'foto_ingredientes': self.foto_ingredientes,
            'foto_macros': self.foto_macros,
            'peso_unidad': self.peso_unidad,
            'nombre_unidad': self.nombre_unidad,
            'favorito': self.favorito,
            'ingredientes': [i.to_dict() for i in self.ingredientes],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
