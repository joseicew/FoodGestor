from app import db
from datetime import date


class PesoHistorico(db.Model):
    __tablename__ = 'peso_historico'

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False, default=date.today)
    peso = db.Column(db.Float, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('usuario_id', 'fecha', name='uq_peso_usuario_fecha'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'fecha': self.fecha.isoformat(),
            'peso': self.peso
        }
