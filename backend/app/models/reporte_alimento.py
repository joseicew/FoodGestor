from app import db
from datetime import datetime
import json


class ReporteAlimento(db.Model):
    __tablename__ = 'reporte_alimento'

    id = db.Column(db.Integer, primary_key=True)
    alimento_id = db.Column(db.Integer, db.ForeignKey('alimento.id'), nullable=False, index=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    campos = db.Column(db.Text, default='[]')  # JSON array: macros, ingredientes, marca, otro
    detalle_macros = db.Column(db.Text, default='[]')  # JSON array de nombres de campo (calorias, proteinas, ...)
    detalle_ingredientes = db.Column(db.Text, default='[]')  # JSON array de nombres de ingrediente
    marca_correcta = db.Column(db.String(255), nullable=True)
    comentario = db.Column(db.Text, default='')
    estado = db.Column(db.String(20), default='pendiente')  # pendiente, resuelto, descartado
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_campos(self):
        return self._get_json(self.campos)

    def set_campos(self, campos):
        self.campos = json.dumps(campos) if isinstance(campos, list) else '[]'

    def get_detalle_macros(self):
        return self._get_json(self.detalle_macros)

    def set_detalle_macros(self, valores):
        self.detalle_macros = json.dumps(valores) if isinstance(valores, list) else '[]'

    def get_detalle_ingredientes(self):
        return self._get_json(self.detalle_ingredientes)

    def set_detalle_ingredientes(self, valores):
        self.detalle_ingredientes = json.dumps(valores) if isinstance(valores, list) else '[]'

    @staticmethod
    def _get_json(valor):
        try:
            return json.loads(valor) if valor else []
        except (json.JSONDecodeError, TypeError):
            return []

    def to_dict(self):
        return {
            'id': self.id,
            'alimento_id': self.alimento_id,
            'usuario_id': self.usuario_id,
            'campos': self.get_campos(),
            'detalle_macros': self.get_detalle_macros(),
            'detalle_ingredientes': self.get_detalle_ingredientes(),
            'marca_correcta': self.marca_correcta or '',
            'comentario': self.comentario or '',
            'estado': self.estado,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
