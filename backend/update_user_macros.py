#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para actualizar los macronutrientes del usuario joseicew@gmail.com
usando la nueva fórmula de cálculo mejorada
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, db
from app.models import Usuario

def main():
    app = create_app()
    with app.app_context():
        print("[UPDATE] Buscando usuario joseicew@gmail.com...")
        usuario = Usuario.query.filter_by(email='joseicew@gmail.com').first()

        if not usuario:
            print("[ERROR] Usuario no encontrado")
            return 1

        print("[INFO] Usuario encontrado:")
        print(f"  - Nombre: {usuario.nombre_completo}")
        print(f"  - Edad: {usuario.edad} años")
        print(f"  - Sexo: {usuario.sexo}")
        print(f"  - Altura: {usuario.altura} cm")
        print(f"  - Peso: {usuario.peso} kg")
        print(f"  - Nivel actividad: {usuario.nivel_actividad}")
        print(f"  - Objetivo: {usuario.objetivo}")

        print("\n[CALCULATE] Recalculando macronutrientes...")
        if usuario.calcular_limites_base():
            print("[SUCCESS] Macronutrientes recalculados:")
            print(f"\n  TMB Calculada: {usuario.tmb_calculada} kcal")
            print(f"  TDEE Calculada: {usuario.tdee_calculada} kcal")
            print(f"\n  Límite Calorías: {usuario.limites_calorias} kcal")
            print(f"  Límite Proteínas: {usuario.limites_proteinas} g")
            print(f"  Límite Grasas: {usuario.limites_grasas} g")
            print(f"  Límite Carbohidratos: {usuario.limites_carbohidratos} g")
            print(f"  Límite Azúcares: {usuario.limites_azucares} g")

            # Guardar cambios
            db.session.commit()
            print("\n[OK] Usuario actualizado exitosamente")
            return 0
        else:
            print("[ERROR] No se pudieron calcular los límites")
            return 1

if __name__ == '__main__':
    sys.exit(main())
