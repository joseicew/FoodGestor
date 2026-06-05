"""
Script para probar la REST API de FoodGestor
Ejecutar: python test_api.py
"""

import requests
import json

BASE_URL = 'http://localhost:5000/api'

def test_health_check():
    """Verificar que la API está corriendo"""
    print("\n📡 Testing Health Check...")
    response = requests.get(f'{BASE_URL}/health')
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

def test_get_alimentos():
    """Obtener todos los alimentos"""
    print("\n🍎 Getting All Alimentos...")
    response = requests.get(f'{BASE_URL}/alimentos')
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)[:500]}...")  # Primeros 500 caracteres

def test_search_by_codigo():
    """Buscar alimento por código"""
    print("\n🔍 Searching Alimento by Codigo...")
    response = requests.get(f'{BASE_URL}/alimentos/buscar/8410000123456')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Encontrado: {data.get('nombre')}")
        print(f"Categoría: {data.get('categoria')}")
        print(f"Calorías: {data.get('macros', {}).get('calorias')}")

def test_get_alergenos():
    """Obtener todos los alérgenos"""
    print("\n⚠️  Getting Alergenos...")
    response = requests.get(f'{BASE_URL}/ingredientes/alergenos')
    print(f"Status: {response.status_code}")
    alergenics = response.json()
    print(f"Alérgenos encontrados: {len(alergenics)}")
    for alerg in alergenics[:3]:
        print(f"   • {alerg.get('nombre')}: {alerg.get('alergenos_asociados')}")

def test_get_aditivos():
    """Obtener todos los aditivos"""
    print("\n🧪 Getting Aditivos...")
    response = requests.get(f'{BASE_URL}/ingredientes/aditivos')
    print(f"Status: {response.status_code}")
    aditivos = response.json()
    print(f"Aditivos encontrados: {len(aditivos)}")
    for adit in aditivos:
        print(f"   • {adit.get('nombre')} ({adit.get('propiedades', {}).get('codigo_aditivo')})")

def test_get_intolerancias():
    """Obtener ingredientes con intolerancias"""
    print("\n⛔ Getting Intolerancias...")
    response = requests.get(f'{BASE_URL}/ingredientes/intolerancias')
    print(f"Status: {response.status_code}")
    intol = response.json()
    print(f"Ingredientes con intolerancias: {len(intol)}")
    for ing in intol:
        print(f"   • {ing.get('nombre')}: {ing.get('intolerancias_asociadas', '')}")

def test_create_alimento():
    """Crear un nuevo alimento"""
    print("\n➕ Creating New Alimento...")
    alimento_data = {
        'nombre': 'Pechuga de Pollo',
        'descripcion': 'Pechuga de pollo fresca',
        'calorias': 165,
        'proteinas': 31,
        'grasas': 3.6,
        'grasas_saturadas': 1,
        'hidratos_carbono': 0,
        'azucares': 0,
        'fibra': 0,
        'sal': 0.07,
        'sodio': 28,
        'potasio': 280,
        'calcio': 11,
        'hierro': 0.8,
        'categoria': 'Proteína',
        'origen': 'España'
    }
    response = requests.post(f'{BASE_URL}/alimentos', json=alimento_data)
    print(f"Status: {response.status_code}")
    print(f"Created: {response.json().get('nombre') if response.status_code == 201 else 'Error'}")

def test_create_ingrediente():
    """Crear un nuevo ingrediente"""
    print("\n➕ Creating New Ingrediente...")
    ingrediente_data = {
        'nombre': 'Huevos de gallina',
        'descripcion': 'Huevos frescos de gallina',
        'es_alergeno': True,
        'alergenos_asociados': 'Huevo',
        'es_vegetariano': True,
        'es_vegano': False
    }
    response = requests.post(f'{BASE_URL}/ingredientes', json=ingrediente_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        data = response.json()
        print(f"Created: {data.get('nombre')}")
        print(f"ID: {data.get('id')}")
        return data.get('id')
    return None

if __name__ == '__main__':
    print("=" * 60)
    print("🍕 FoodGestor API Testing (Macros & Alimentos)")
    print("=" * 60)
    
    try:
        test_health_check()
        test_get_alimentos()
        test_search_by_codigo()
        test_get_alergenos()
        test_get_aditivos()
        test_get_intolerancias()
        test_create_alimento()
        test_create_ingrediente()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to the API")
        print("Make sure the Flask server is running: python main.py")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
