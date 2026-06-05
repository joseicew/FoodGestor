import sqlite3
import os

db_path = os.path.expanduser('~/Documents/Proyectos/FoodGestor/instance/foodgestor.db')

if not os.path.exists(db_path):
    print("Database not found at:", db_path)
    exit(1)

print("Using database:", db_path)

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
