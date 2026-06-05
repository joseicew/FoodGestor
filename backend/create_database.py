"""
Script para crear la base de datos automáticamente con datos de prueba
Ejecutar: python create_database.py
"""

from app import create_app, db
from app.models import Alimento, Codigo, Ingrediente

def create_database():
    """Crear las tablas de la base de datos y agregar datos de prueba"""
    
    try:
        app = create_app()
        
        with app.app_context():
            # Eliminar tablas anteriores (solo para desarrollo)
            db.drop_all()
            
            # Crear todas las tablas
            db.create_all()
            print("✅ Base de datos 'foodgestor.db' creada/verificada")
            print("✅ Tablas creadas:")
            print("   • alimento")
            print("   • codigo")
            print("   • ingrediente")
            print("   • food_ingredient (relación)")
            
            # ============================================
            # CREAR INGREDIENTES DE PRUEBA
            # ============================================
            print("\n📝 Agregando ingredientes de prueba...")
            
            ing_gluten = Ingrediente(
                nombre='Gluten',
                descripcion='Proteína encontrada en trigo, cebada y centeno',
                es_alergeno=True,
                alergenos_asociados='Trigo, cebada, centeno, avena',
                es_intolerancia=True,
                intolerancias_asociadas='Enfermedad celíaca, sensibilidad al gluten',
                es_vegetariano=True,
                es_vegano=True,
                notas='Causa problemas a celíacos'
            )
            
            ing_lactosa = Ingrediente(
                nombre='Lactosa',
                descripcion='Azúcar presente en la leche',
                es_alergeno=False,
                es_intolerancia=True,
                intolerancias_asociadas='Intolerancia a la lactosa',
                es_aditivo=False,
                es_vegetariano=True,
                es_vegano=False,
                notas='Presente en productos lácteos'
            )
            
            ing_cacahuete = Ingrediente(
                nombre='Cacahuete',
                descripcion='Legumbre con alto contenido de proteína',
                es_alergeno=True,
                alergenos_asociados='Cacahuete, frutos secos',
                es_intolerancia=False,
                es_vegetariano=True,
                es_vegano=True,
                notas='Alérgeno común, riesgo de anafilaxia'
            )
            
            ing_conservante_e250 = Ingrediente(
                nombre='Nitrito de sodio',
                descripcion='Conservante utilizado en carnes procesadas',
                es_alergeno=False,
                es_intolerancia=False,
                es_aditivo=True,
                tipo_aditivo='Conservante',
                codigo_aditivo='E250',
                es_conservante=True,
                es_vegetariano=False,
                es_vegano=False,
                notas='Puede formar nitrosaminas'
            )
            
            ing_colorante_e102 = Ingrediente(
                nombre='Tartrazina',
                descripcion='Colorante artificial amarillo',
                es_alergeno=True,
                alergenos_asociados='Sensibilidad a colorantes',
                es_aditivo=True,
                tipo_aditivo='Colorante',
                codigo_aditivo='E102',
                es_vegetariano=True,
                es_vegano=True,
                notas='Puede causar reacciones en personas sensibles'
            )
            
            ing_lechuga = Ingrediente(
                nombre='Lechuga',
                descripcion='Verdura de hoja verde',
                es_alergeno=False,
                es_intolerancia=False,
                es_aditivo=False,
                es_conservante=False,
                origen='Vegetal',
                es_vegetariano=True,
                es_vegano=True
            )
            
            ing_tomate = Ingrediente(
                nombre='Tomate',
                descripcion='Fruto rojo rico en licopeno',
                es_alergeno=False,
                es_intolerancia=False,
                es_aditivo=False,
                es_conservante=False,
                origen='Vegetal',
                es_vegetariano=True,
                es_vegano=True
            )
            
            ing_huevo = Ingrediente(
                nombre='Huevo de gallina',
                descripcion='Producto de origen animal',
                es_alergeno=True,
                alergenos_asociados='Huevo',
                es_intolerancia=False,
                es_vegetariano=True,
                es_vegano=False,
                notas='Alérgeno común en alimentos'
            )
            
            # Agregar ingredientes a la BD
            ingredientes = [
                ing_gluten, ing_lactosa, ing_cacahuete, ing_conservante_e250,
                ing_colorante_e102, ing_lechuga, ing_tomate, ing_huevo
            ]
            
            for ing in ingredientes:
                db.session.add(ing)
            
            db.session.commit()
            print(f"   ✅ {len(ingredientes)} ingredientes agregados")
            
            # ============================================
            # CREAR ALIMENTOS DE PRUEBA
            # ============================================
            print("\n🍎 Agregando alimentos de prueba...")
            
            # Alimento 1: Manzana
            alimento_manzana = Alimento(
                nombre='Manzana Roja',
                descripcion='Manzana fresca de calidad premium',
                calorias=52,
                proteinas=0.3,
                grasas=0.2,
                grasas_saturadas=0.03,
                hidratos_carbono=13.8,
                azucares=10.4,
                fibra=2.4,
                sal=0.002,
                sodio=1,
                potasio=107,
                calcio=5,
                hierro=0.12,
                categoria='Fruta',
                origen='España'
            )
            
            # Agregar códigos a la manzana
            codigo_manzana_ean = Codigo(
                tipo_codigo='EAN',
                valor='8410000123456',
                descripcion='Código EAN manzana roja'
            )
            codigo_manzana_sku = Codigo(
                tipo_codigo='SKU',
                valor='MANZ-001',
                descripcion='SKU interno manzana'
            )
            alimento_manzana.codigos.append(codigo_manzana_ean)
            alimento_manzana.codigos.append(codigo_manzana_sku)
            
            # Alimento 2: Ensalada Mixta
            alimento_ensalada = Alimento(
                nombre='Ensalada Mixta',
                descripcion='Ensalada fresca con lechuga, tomate y verduras variadas',
                calorias=15,
                proteinas=1.2,
                grasas=0.2,
                grasas_saturadas=0.03,
                hidratos_carbono=2.9,
                azucares=1.7,
                fibra=1.2,
                sal=0.03,
                sodio=12,
                potasio=194,
                calcio=33,
                hierro=0.4,
                categoria='Verdura',
                origen='Italia'
            )
            alimento_ensalada.ingredientes.append(ing_lechuga)
            alimento_ensalada.ingredientes.append(ing_tomate)
            
            codigo_ensalada = Codigo(
                tipo_codigo='EAN',
                valor='8410000654321',
                descripcion='Código EAN ensalada mixta'
            )
            alimento_ensalada.codigos.append(codigo_ensalada)
            
            # Alimento 3: Pan integral
            alimento_pan = Alimento(
                nombre='Pan Integral',
                descripcion='Pan integral con semillas',
                calorias=265,
                proteinas=9.0,
                grasas=3.3,
                grasas_saturadas=0.5,
                hidratos_carbono=49.0,
                azucares=4.0,
                fibra=6.8,
                sal=1.2,
                sodio=480,
                potasio=230,
                calcio=47,
                hierro=3.6,
                categoria='Cereal',
                origen='Francia'
            )
            alimento_pan.ingredientes.append(ing_gluten)
            
            # Alimento 4: Jamón Serrano
            alimento_jamon = Alimento(
                nombre='Jamón Serrano',
                descripcion='Jamón curado de calidad',
                calorias=161,
                proteinas=29.0,
                grasas=6.3,
                grasas_saturadas=2.5,
                hidratos_carbono=0,
                azucares=0,
                fibra=0,
                sal=2.0,
                sodio=800,
                potasio=280,
                calcio=10,
                hierro=1.8,
                categoria='Proteína',
                origen='España'
            )
            alimento_jamon.ingredientes.append(ing_conservante_e250)
            
            # Alimento 5: Galletas de trigo
            alimento_galletas = Alimento(
                nombre='Galletas de Trigo',
                descripcion='Galletas crujientes integrales',
                calorias=402,
                proteinas=9.0,
                grasas=10.0,
                grasas_saturadas=2.0,
                hidratos_carbono=68.0,
                azucares=12.0,
                fibra=2.4,
                sal=1.3,
                sodio=520,
                potasio=200,
                calcio=100,
                hierro=2.0,
                categoria='Cereal',
                origen='Alemania'
            )
            alimento_galletas.ingredientes.append(ing_gluten)
            alimento_galletas.ingredientes.append(ing_huevo)
            alimento_galletas.ingredientes.append(ing_colorante_e102)
            
            # Agregar alimentos a la BD
            alimentos = [alimento_manzana, alimento_ensalada, alimento_pan, alimento_jamon, alimento_galletas]
            
            for alim in alimentos:
                db.session.add(alim)
            
            db.session.commit()
            print(f"   ✅ {len(alimentos)} alimentos agregados")
            
            # ============================================
            # MOSTRAR INFORMACIÓN
            # ============================================
            print("\n📊 Información de la BD:")
            
            # Contar registros
            total_alimentos = Alimento.query.count()
            total_ingredientes = Ingrediente.query.count()
            total_codigos = Codigo.query.count()
            
            print(f"   • Alimentos: {total_alimentos}")
            print(f"   • Ingredientes: {total_ingredientes}")
            print(f"   • Códigos: {total_codigos}")
            
            # Mostrar alimentos creados
            print("\n🍽️  Alimentos creados:")
            for alim in alimentos:
                print(f"   • {alim.nombre} - {alim.categoria}")
                if alim.ingredientes:
                    print(f"     Ingredientes: {', '.join([i.nombre for i in alim.ingredientes])}")
                if alim.codigos:
                    print(f"     Códigos: {', '.join([f'{c.tipo_codigo}:{c.valor}' for c in alim.codigos])}")
            
            print("\n📌 Ingredientes especiales detectados:")
            for ing in ingredientes:
                props = []
                if ing.es_alergeno:
                    props.append("⚠️  ALERGENO")
                if ing.es_intolerancia:
                    props.append("⛔ INTOLERANCIA")
                if ing.es_aditivo:
                    props.append(f"🧪 ADITIVO {ing.codigo_aditivo or ''}")
                if props:
                    print(f"   • {ing.nombre}: {', '.join(props)}")
            
            print("\n✅ ¡Base de datos lista para usar!")
            print("   Ejecuta: python main.py")
            
    except Exception as err:
        print(f"❌ Error: {str(err)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("="*70)
    print("🗄️  Creador de Base de Datos - FoodGestor (Macros & Alimentos)")
    print("="*70 + "\n")
    create_database()
    print("\n" + "="*70)
