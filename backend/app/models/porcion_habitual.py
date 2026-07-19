from app import db
from datetime import datetime


class PorcionHabitual(db.Model):
    """Cantidad (en g/ml) que un usuario suele consumir de un alimento concreto."""
    __tablename__ = 'porcion_habitual'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False, index=True)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimento.id'), nullable=False, index=True)
    cantidad = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('usuario_id', 'alimento_id', name='uq_porcion_habitual_usuario_alimento'),
    )

    def to_dict(self):
        return {
            'alimento_id': self.alimento_id,
            'cantidad': self.cantidad,
        }
