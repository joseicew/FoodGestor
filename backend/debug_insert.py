"""
Script de debug para insertar datos paso a paso
"""

from app import create_app, db
from app.models import Alimento, Ingrediente, Codigo

app = create_app()

with app.app_context():
    try:
        print("1. Eliminando tablas...")
        db.drop_all()
        print("   ✅ OK")
        
        print("2. Creando tablas...")
        db.create_all()
        print("   ✅ OK")
        
        print("3. Creando ingrediente 1...")
        ing1 = Ingrediente(nombre='Gluten', es_alergeno=True)
        db.session.add(ing1)
        db.session.commit()
        print("   ✅ OK")
        
        print("4. Creando ingrediente 2...")
        ing2 = Ingrediente(nombre='Lactosa', es_intolerancia=True)
        db.session.add(ing2)
        db.session.commit()
        print("   ✅ OK")
        
        print("5. Creando alimento...")
        alim = Alimento(
            nombre='Pan',
            calorias=265,
            proteinas=9,
            grasas=3.3,
            hidratos_carbono=49
        )
        db.session.add(alim)
        db.session.commit()
        print("   ✅ OK")
        
        print("6. Asociando ingrediente a alimento...")
        alim.ingredientes.append(ing1)
        db.session.commit()
        print("   ✅ OK")
        
        print("7. Creando código...")
        cod = Codigo(
            food_id=alim.id,
            tipo_codigo='EAN',
            valor='8410000123456'
        )
        db.session.add(cod)
        db.session.commit()
        print("   ✅ OK")
        
        print("\n✅ ¡Todos los datos insertados correctamente!")
        print(f"   Alimentos: {Alimento.query.count()}")
        print(f"   Ingredientes: {Ingrediente.query.count()}")
        print(f"   Códigos: {Codigo.query.count()}")
        
    except Exception as e:
        print(f"\n❌ Error en paso anterior: {str(e)}")
        import traceback
        traceback.print_exc()
