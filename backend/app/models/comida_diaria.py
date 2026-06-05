from app import db
from datetime import datetime

# Tabla de unión para relación Many-to-Many entre ComidaDiaria y Racion
comida_raciones = db.Table(
    'comida_raciones',
    db.Column('comida_diaria_id', db.Integer, db.ForeignKey('comida_diaria.id'), primary_key=True),
    db.Column('racion_id', db.Integer, db.ForeignKey('racion.id'), primary_key=True),
    db.Column('cantidad', db.Float, default=1),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

# Tabla de unión para relación Many-to-Many entre ComidaDiaria y Alimento
comida_alimentos = db.Table(
    'comida_alimentos',
    db.Column('comida_diaria_id', db.Integer, db.ForeignKey('comida_diaria.id'), primary_key=True),
    db.Column('alimento_id', db.Integer, db.ForeignKey('alimento.id'), primary_key=True),
    db.Column('cantidad', db.Float, default=100),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)


class ComidaDiaria(db.Model):
    """Modelo para registrar las comidas consumidas en un día"""
    __tablename__ = 'comida_diaria'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False, index=True)
    tipo_comida = db.Column(
        db.String(20),
        nullable=False,
        default='comida'
    )  # 'desayuno', 'almuerzo', 'comida', 'merienda', 'cena'

    # Relaciones Many-to-Many
    raciones = db.relationship(
        'Racion',
        secondary=comida_raciones,
        backref=db.backref('comidas_diarias', lazy='dynamic')
    )
    alimentos = db.relationship(
        'Alimento',
        secondary=comida_alimentos,
        backref=db.backref('comidas_diarias', lazy='dynamic')
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_cantidad_racion(self, racion_id):
        """Obtiene la cantidad de una ración específica"""
        row = db.session.execute(
            comida_raciones.select().where(
                (comida_raciones.c.comida_diaria_id == self.id) &
                (comida_raciones.c.racion_id == racion_id)
            )
        ).first()
        return row.cantidad if row else 1

    def get_cantidad_alimento(self, alimento_id):
        """Obtiene la cantidad de un alimento específico"""
        row = db.session.execute(
            comida_alimentos.select().where(
                (comida_alimentos.c.comida_diaria_id == self.id) &
                (comida_alimentos.c.alimento_id == alimento_id)
            )
        ).first()
        return row.cantidad if row else 100

    def calcular_totales(self):
        """Calcula los totales nutricionales de la comida"""
        totales = {
            'calorias': 0,
            'proteinas': 0,
            'grasas': 0,
            'hidratos_carbono': 0,
            'fibra': 0,
            'azucares': 0,
            'grasas_saturadas': 0,
            'sal': 0,
            'sodio': 0,
            'potasio': 0,
            'calcio': 0,
            'hierro': 0
        }

        # Sumar totales de raciones
        for racion in self.raciones:
            cantidad = self.get_cantidad_racion(racion.id)
            # Las raciones ya tienen totales calculados
            if hasattr(racion, 'totales'):
                for key in totales:
                    if key in racion.totales:
                        totales[key] += racion.totales.get(key, 0) * (cantidad / 100)

        # Sumar totales de alimentos
        for alimento in self.alimentos:
            cantidad = self.get_cantidad_alimento(alimento.id)
            # Calcular proporción (la cantidad estándar es 100g)
            proporcion = cantidad / 100

            totales['calorias'] += (alimento.calorias or 0) * proporcion
            totales['proteinas'] += (alimento.proteinas or 0) * proporcion
            totales['grasas'] += (alimento.grasas or 0) * proporcion
            totales['hidratos_carbono'] += (alimento.hidratos_carbono or 0) * proporcion
            totales['fibra'] += (alimento.fibra or 0) * proporcion
            totales['azucares'] += (alimento.azucares or 0) * proporcion
            totales['grasas_saturadas'] += (alimento.grasas_saturadas or 0) * proporcion
            totales['sal'] += (alimento.sal or 0) * proporcion
            totales['sodio'] += (alimento.sodio or 0) * proporcion
            totales['potasio'] += (alimento.potasio or 0) * proporcion
            totales['calcio'] += (alimento.calcio or 0) * proporcion
            totales['hierro'] += (alimento.hierro or 0) * proporcion

        return totales

    def to_dict(self):
        """Convierte el objeto a diccionario incluyendo totales"""
        return {
            'id': self.id,
            'fecha': self.fecha.isoformat(),
            'tipo_comida': self.tipo_comida,
            'raciones': [
                {
                    'id': r.id,
                    'nombre': r.nombre,
                    'descripcion': r.descripcion,
                    'cantidad': self.get_cantidad_racion(r.id),
                    'alimentos': [
                        {
                            'id': ali.id,
                            'nombre': ali.nombre,
                            'marca': ali.marca,
                            'calorias': ali.calorias,
                            'proteinas': ali.proteinas,
                            'grasas': ali.grasas,
                            'hidratos_carbono': ali.hidratos_carbono
                        }
                        for ali in (r.alimentos if hasattr(r, 'alimentos') else [])
                    ]
                }
                for r in self.raciones
            ],
            'alimentos': [
                {
                    'id': a.id,
                    'nombre': a.nombre,
                    'marca': a.marca,
                    'cantidad': self.get_cantidad_alimento(a.id),
                    'calorias': a.calorias,
                    'proteinas': a.proteinas,
                    'grasas': a.grasas,
                    'hidratos_carbono': a.hidratos_carbono,
                    'azucares': a.azucares,
                    'fibra': a.fibra,
                    'grasas_saturadas': a.grasas_saturadas,
                    'sal': a.sal,
                    'categoria': a.categoria
                }
                for a in self.alimentos
            ],
            'totales': self.calcular_totales(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
