import sqlite3
import os

databases = [
    os.path.expanduser('~/Documents/Proyectos/FoodGestor/instance/foodgestor.db'),
    os.path.expanduser('~/Documents/Proyectos/FoodGestor/backend/instance/foodgestor.db'),
]

for db_path in databases:
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        continue
    
    print(f"\nUpdating: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute("PRAGMA table_info(alimento)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'peso_unidad' not in columns:
            print("Adding peso_unidad column...")
            cursor.execute("ALTER TABLE alimento ADD COLUMN peso_unidad FLOAT")
            print("peso_unidad column added")
        else:
            print("peso_unidad column already exists")
        
        if 'nombre_unidad' not in columns:
            print("Adding nombre_unidad column...")
            cursor.execute("ALTER TABLE alimento ADD COLUMN nombre_unidad VARCHAR(50)")
            print("nombre_unidad column added")
        else:
            print("nombre_unidad column already exists")
        
        conn.commit()
        print("Migration completed successfully")
    except Exception as e:
        print("Error:", str(e))
        conn.rollback()
    finally:
        conn.close()

print("\nAll databases updated!")
