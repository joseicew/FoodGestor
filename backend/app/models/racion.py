from app import db
from datetime import datetime


racion_alimentos = db.Table(
    'racion_alimentos',
    db.Column('racion_id', db.Integer, db.ForeignKey('racion.id'), primary_key=True),
    db.Column('alimento_id', db.Integer, db.ForeignKey('alimento.id'), primary_key=True),
    db.Column('cantidad', db.Float, default=100)  # gramos
)


class Racion(db.Model):
    __tablename__ = 'racion'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False, index=True)
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    alimentos = db.relationship(
        'Alimento',
        secondary=racion_alimentos,
        lazy='select',
        backref=db.backref('raciones', lazy='select')
    )

    def to_dict(self):
        from sqlalchemy import text

        # Obtener todas las cantidades de la tabla junction
        query = text(
            'SELECT alimento_id, cantidad FROM racion_alimentos WHERE racion_id = :racion_id'
        )
        result = db.session.execute(query, {'racion_id': self.id}).fetchall()
        cantidades = {row[0]: row[1] for row in result}

        # Calcular totales
        total_calorias = 0.0
        total_proteinas = 0.0
        total_grasas = 0.0
        total_hidratos = 0.0
        total_fibra = 0.0
        total_azucares = 0.0
        alimentos_list = []

        for alimento in self.alimentos:
            cantidad = cantidades.get(alimento.id, 100)

            # Calcular proporcionales (por 100g)
            factor = cantidad / 100.0

            total_calorias += (alimento.calorias or 0) * factor
            total_proteinas += (alimento.proteinas or 0) * factor
            total_grasas += (alimento.grasas or 0) * factor
            total_hidratos += (alimento.hidratos_carbono or 0) * factor
            total_fibra += (alimento.fibra or 0) * factor
            total_azucares += (alimento.azucares or 0) * factor

            alimentos_list.append({
                'id': alimento.id,
                'nombre': alimento.nombre,
                'marca': alimento.marca,
                'cantidad': cantidad,
                'calorias': alimento.calorias
            })

        return {
            'id': self.id,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'alimentos': alimentos_list,
            'totales': {
                'calorias': round(total_calorias, 2),
                'proteinas': round(total_proteinas, 2),
                'grasas': round(total_grasas, 2),
                'hidratos_carbono': round(total_hidratos, 2),
                'fibra': round(total_fibra, 2),
                'azucares': round(total_azucares, 2)
            },
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
