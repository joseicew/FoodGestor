"""
Script para visualizar la información del esquema de la BD
Ejecutar: python schema_info.py
"""

from app import create_app, db
from app.models import Alimento, Ingrediente, Codigo
import inspect

def print_schema_info():
    """Mostrar información del esquema de la BD"""
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*70)
        print("📊 ESQUEMA DE BASE DE DATOS - FoodGestor")
        print("="*70)
        
        # Obtener todas las tablas
        tables = db.inspect(db.engine).get_table_names()
        
        print(f"\n✅ Base de datos: foodgestor")
        print(f"📋 Tablas encontradas: {len(tables)}\n")
        
        for table_name in tables:
            print(f"\n{'─'*70}")
            print(f"📦 Tabla: {table_name.upper()}")
            print(f"{'─'*70}")
            
            # Obtener columnas
            columns = db.inspect(db.engine).get_columns(table_name)
            
            print(f"{'Columna':<20} {'Tipo':<20} {'Nullable':<12} {'Default'}")
            print("─" * 70)
            
            for column in columns:
                col_name = column['name']
                col_type = str(column['type'])
                col_nullable = "Sí" if column['nullable'] else "No"
                col_default = column.get('default', 'N/A')
                
                print(f"{col_name:<20} {col_type:<20} {col_nullable:<12} {col_default}")
            
            # Obtener claves foráneas
            foreign_keys = db.inspect(db.engine).get_foreign_keys(table_name)
            if foreign_keys:
                print(f"\n🔗 Relaciones:")
                for fk in foreign_keys:
                    print(f"   {fk['name']}: {fk['constrained_columns']} → {fk['referred_table']}")
            
            # Obtener índices
            indexes = db.inspect(db.engine).get_indexes(table_name)
            if indexes:
                print(f"\n🔍 Índices:")
                for idx in indexes:
                    print(f"   {idx['name']}: {idx['column_names']}")

def print_model_info():
    """Mostrar información de los modelos"""
    print(f"\n\n{'='*70}")
    print("🗂️  MODELOS DEFINIDOS (ORM)")
    print("="*70)
    
    models = [Alimento, Ingrediente, Codigo]
    
    for model in models:
        print(f"\n📌 Modelo: {model.__name__}")
        print(f"   Tabla: {model.__tablename__}")
        print(f"   Campos:")
        
        for column in model.__table__.columns:
            col_type = str(column.type)
            col_info = f"      • {column.name:<20} ({col_type})"
            
            if column.primary_key:
                col_info += " [PRIMARY KEY]"
            if not column.nullable:
                col_info += " [NOT NULL]"
            if column.unique:
                col_info += " [UNIQUE]"
            if column.default:
                col_info += f" [DEFAULT: {column.default}]"
            
            print(col_info)

def generate_diagram():
    """Generar diagrama ASCII del esquema"""
    print(f"\n\n{'='*70}")
    print("📐 DIAGRAMA RELACIONAL")
    print("="*70)
    
    diagram = """
    ┌─────────────────────────────────────────────┐
    │ ALIMENTO                                    │
    ├─────────────────────────────────────────────┤
    │ PK  id (INT)                                │
    │     nombre (VARCHAR) - UNIQUE               │
    │     descripcion (VARCHAR)                   │
    │                                             │
    │ MACROS (por 100g):                          │
    │     calorias (FLOAT)                        │
    │     proteinas (FLOAT)                       │
    │     grasas (FLOAT)                          │
    │     grasas_saturadas (FLOAT)                │
    │     hidratos_carbono (FLOAT)                │
    │     azucares (FLOAT)                        │
    │     fibra (FLOAT)                           │
    │     sal (FLOAT)                             │
    │     sodio (FLOAT)                           │
    │     potasio (FLOAT)                         │
    │     calcio (FLOAT)                          │
    │     hierro (FLOAT)                          │
    │                                             │
    │     categoria (VARCHAR)                     │
    │     origen (VARCHAR)                        │
    │     created_at (DATETIME)                   │
    │     updated_at (DATETIME)                   │
    └─────────────────────────────────────────────┘
              ↓                           ↓
              │ 1:N                       │ N:M
              │                           │
    ┌─────────────────────────────┐     ┌─────────────────────────────┐
    │ CODIGO                      │     │ INGREDIENTE                 │
    ├─────────────────────────────┤     ├─────────────────────────────┤
    │ PK  id (INT)                │     │ PK  id (INT)                │
    │ FK  food_id (INT)           │     │     nombre (VARCHAR)        │
    │     tipo_codigo (VARCHAR)   │     │     descripcion (VARCHAR)   │
    │     valor (VARCHAR)         │     │     es_alergeno (BOOLEAN)   │
    │     descripcion (VARCHAR)   │     │     alergenos_asociados     │
    │     activo (BOOLEAN)        │     │     es_intolerancia         │
    │     created_at (DATETIME)   │     │     intolerancias_asoc.     │
    │     updated_at (DATETIME)   │     │     es_aditivo (BOOLEAN)    │
    └─────────────────────────────┘     │     tipo_aditivo (VARCHAR)  │
                                        │     es_conservante          │
    ┌──────────────────────────────────┤     codigo_aditivo (VARCHAR)│
    │ FOOD_INGREDIENT (N:M)            │     origen (VARCHAR)         │
    ├──────────────────────────────────┤     es_vegetariano (BOOLEAN) │
    │ FK  food_id (INT)                │     es_vegano (BOOLEAN)      │
    │ FK  ingredient_id (INT)          │     notas (TEXT)             │
    └──────────────────────────────────┘     created_at (DATETIME)   │
                                        │     updated_at (DATETIME)   │
                                        └─────────────────────────────┘
    
    RELACIONES:
    • 1 ALIMENTO puede tener N CODIGOS (búsqueda por EAN, SKU, etc)
    • 1 ALIMENTO puede tener N INGREDIENTES (N:M - tabla food_ingredient)
    • 1 INGREDIENTE puede estar en N ALIMENTOS
    """
    
    print(diagram)

if __name__ == '__main__':
    try:
        print_model_info()
        print_schema_info()
        generate_diagram()
        
        print(f"\n{'='*70}")
        print("✅ Esquema cargado exitosamente!")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("Asegúrate de que MySQL está corriendo y configurado en .env")
