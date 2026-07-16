from app import db
from datetime import datetime
import json


class ReporteAlimento(db.Model):
    __tablename__ = 'reporte_alimento'

    id = db.Column(db.Integer, primary_key=True)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimento.id'), nullable=False, index=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    campos = db.Column(db.Text, default='[]')  # JSON array: macros, ingredientes, marca, otro
    comentario = db.Column(db.Text, default='')
    estado = db.Column(db.String(20), default='pendiente')  # pendiente, resuelto, descartado
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_campos(self):
        try:
            return json.loads(self.campos) if self.campos else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_campos(self, campos):
        self.campos = json.dumps(campos) if isinstance(campos, list) else '[]'

    def to_dict(self):
        return {
            'id': self.id,
            'alimento_id': self.alimento_id,
            'usuario_id': self.usuario_id,
            'campos': self.get_campos(),
            'comentario': self.comentario or '',
            'estado': self.estado,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
