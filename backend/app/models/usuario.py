from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


class Usuario(db.Model):
    """Modelo para registrar usuarios del sistema"""
    __tablename__ = 'usuario'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    # Datos personales
    nombre_completo = db.Column(db.String(255), nullable=False, default='Usuario')
    edad = db.Column(db.Integer, default=30)
    sexo = db.Column(db.String(10), default='M')  # M/F/Otro
    altura = db.Column(db.Float, default=170)  # cm
    peso = db.Column(db.Float, default=70)  # kg

    # Objetivos y actividad
    nivel_actividad = db.Column(db.String(50), default='moderado')  # sedentario, ligero, moderado, activo, muy_activo
    objetivo = db.Column(db.String(50), default='mantener')  # perder_peso, mantener, ganar_musculo

    # Límites nutricionales personalizados
    limites_calorias = db.Column(db.Float, default=2500)
    limites_proteinas = db.Column(db.Float, default=100)
    limites_grasas = db.Column(db.Float, default=80)
    limites_carbohidratos = db.Column(db.Float, default=250)  # Hidratos de carbono
    limites_azucares = db.Column(db.Float, default=62)  # Azúcares simples (OMS: menos del 10% de calorías diarias)

    # Valores calculados para referencia
    tmb_calculada = db.Column(db.Float, default=0)  # Tasa Metabólica Basal
    getd_calculada = db.Column(db.Float, default=0)  # GETD (sin déficit/superávit)
    tdee_calculada = db.Column(db.Float, default=0)  # Gasto Energético Diario Total (con déficit/superávit)

    # Relaciones inversas
    alimentos = db.relationship('Alimento', backref='usuario', lazy='select')
    raciones = db.relationship('Racion', backref='usuario', lazy='select')
    comidas_diarias = db.relationship('ComidaDiaria', backref='usuario', lazy='select')

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password):
        """Hashea y almacena la contraseña"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifica que la contraseña sea correcta"""
        return check_password_hash(self.password_hash, password)

    def calcular_limites_base(self):
        """
        Calcula automáticamente los límites base usando la fórmula de Mifflin-St Jeor.

        PASO 1: Calcula el TMB (Tasa Metabólica Basal)
        PASO 2: Ajusta según nivel de actividad (GETD)
        PASO 3: Aplica déficit o superávit según objetivo
        PASO 4: Distribuye macronutrientes (proteínas, grasas, carbohidratos)
        """
        if not all([self.edad, self.peso, self.altura]):
            return False

        # ============================================
        # PASO 1: Calcular TMB (Tasa Metabólica Basal)
        # Fórmula de Mifflin-St Jeor
        # ============================================
        if self.sexo == 'M':
            # Hombres: TMB = (10×peso) + (6.25×altura) - (5×edad) + 5
            tmb = (10 * self.peso) + (6.25 * self.altura) - (5 * self.edad) + 5
        else:  # F/Otro
            # Mujeres: TMB = (10×peso) + (6.25×altura) - (5×edad) - 161
            tmb = (10 * self.peso) + (6.25 * self.altura) - (5 * self.edad) - 161

        self.tmb_calculada = round(tmb, 1)

        # ============================================
        # PASO 2: Ajustar por Nivel de Actividad (GETD)
        # ============================================
        factores_actividad = {
            'sedentario': 1.2,      # 0-1 día/semana
            'ligero': 1.375,        # 1-3 días/semana
            'moderado': 1.55,       # 3-4 días/semana
            'activo': 1.725,        # 5-6 días/semana
            'muy_activo': 1.9       # 6-7 días/semana
        }
        factor_actividad = factores_actividad.get(self.nivel_actividad, 1.55)

        # GETD = TMB × factor_actividad
        getd = tmb * factor_actividad
        self.getd_calculada = round(getd, 1)

        # ============================================
        # PASO 3: Aplicar Objetivo (déficit/superávit)
        # ============================================
        if self.objetivo == 'perder_peso':
            # Déficit de 15-20% para perder 0.5-1 kg/semana
            # Usando 15% de déficit (0.85 factor)
            tdee = getd * 0.85
        elif self.objetivo == 'ganar_musculo':
            # Superávit de 10% para ganar músculo
            tdee = getd * 1.1
        else:  # mantener
            # Sin déficit ni superávit
            tdee = getd

        self.tdee_calculada = round(tdee, 1)
        self.limites_calorias = round(tdee, 0)

        # ============================================
        # PASO 4: Calcular Macronutrientes
        # ============================================

        # PROTEÍNAS: 1.8-2.2g/kg según objetivo
        # - Ganar músculo: 2.2g/kg (máximo para retener proteína)
        # - Perder peso: 1.8g/kg (mantener masa muscular en déficit)
        # - Mantener: 1.6g/kg (mantenimiento normal)
        if self.objetivo == 'ganar_musculo':
            proteinas_g = self.peso * 2.2
        elif self.objetivo == 'perder_peso':
            proteinas_g = self.peso * 1.8  # Aumentamos proteína en déficit
        else:
            proteinas_g = self.peso * 1.6

        self.limites_proteinas = round(proteinas_g, 1)

        # GRASAS: 25-30% de calorías totales
        # Esenciales para sistema hormonal
        # 1g de grasa = 9 kcal
        # Usando 25% para déficit calórico, 30% para superávit
        if self.objetivo == 'perder_peso':
            porcentaje_grasas = 0.25  # 25% en déficit
        else:
            porcentaje_grasas = 0.30  # 30% en mantenimiento/superávit

        grasas_kcal = self.limites_calorias * porcentaje_grasas
        grasas_g = grasas_kcal / 9
        self.limites_grasas = round(grasas_g, 1)

        # CARBOHIDRATOS: El resto de calorías después de proteína y grasa
        # 1g de carbohidrato = 4 kcal
        # Carbohidratos = (Calorías totales - Proteína(kcal) - Grasa(kcal)) / 4
        proteinas_kcal = self.limites_proteinas * 4
        carbohidratos_kcal = self.limites_calorias - proteinas_kcal - grasas_kcal
        carbohidratos_g = carbohidratos_kcal / 4
        self.limites_carbohidratos = round(carbohidratos_g, 1)

        # AZÚCARES SIMPLES: Máximo 25% de calorías (recomendación OMS)
        # 1g de azúcar = 4 kcal
        azucares_kcal = self.limites_calorias * 0.25
        azucares_g = azucares_kcal / 4
        self.limites_azucares = round(azucares_g, 1)

        return True

    def to_dict(self):
        """Convierte el objeto a diccionario (sin incluir password_hash)"""
        return {
            'id': self.id,
            'email': self.email,
            'nombre_completo': self.nombre_completo,
            'edad': self.edad,
            'sexo': self.sexo,
            'altura': self.altura,
            'peso': self.peso,
            'nivel_actividad': self.nivel_actividad,
            'objetivo': self.objetivo,
            # Límites nutricionales
            'limites_calorias': self.limites_calorias,
            'limites_proteinas': self.limites_proteinas,
            'limites_grasas': self.limites_grasas,
            'limites_carbohidratos': self.limites_carbohidratos,
            'limites_azucares': self.limites_azucares,
            # Valores calculados (para referencia)
            'tmb_calculada': self.tmb_calculada,
            'getd_calculada': self.getd_calculada,
            'tdee_calculada': self.tdee_calculada,
            # Estructura legacy para compatibilidad
            'limites_base': {
                'calorias': self.limites_calorias,
                'proteinas': self.limites_proteinas,
                'grasas': self.limites_grasas,
                'carbohidratos': self.limites_carbohidratos,
                'azucares': self.limites_azucares
            },
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
