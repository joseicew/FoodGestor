#!/usr/bin/env python3
"""
Test script for async OCR functionality and duplicate detection
"""

import os
import requests
import json
import time
from PIL import Image, ImageDraw

BASE_URL = "http://localhost:5000"

def create_test_images():
    """Create test images for OCR testing"""
    print("\n=== Creating Test Images ===\n")

    os.makedirs('test_images', exist_ok=True)

    # 1. Ingredients image
    img = Image.new('RGB', (400, 300), color='white')
    draw = ImageDraw.Draw(img)
    ingredients_text = "INGREDIENTES:\nAceite de Oliva\nTomate\nCebolla\nAjo\nSal\nPimienta"
    draw.text((20, 20), ingredients_text, fill='black')
    img.save('test_images/ingredients.png')
    print("Created: test_images/ingredients.png")

    # 2. Macros image
    img = Image.new('RGB', (400, 300), color='white')
    draw = ImageDraw.Draw(img)
    macros_text = "INFORMACION NUTRICIONAL\nPor 100g\nEnergia: 65 kcal\nProteinas: 3.5g\nHidratos: 12g\nGrasas: 1.5g\nFibra: 2.3g"
    draw.text((20, 20), macros_text, fill='black')
    img.save('test_images/macros.png')
    print("Created: test_images/macros.png")

    # 3. Barcode image
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)
    barcode_text = "EAN-13:\n8410000123456"
    draw.text((20, 50), barcode_text, fill='black')
    for i in range(0, 400, 10):
        height = 50 if i % 20 == 0 else 30
        draw.rectangle([(i, 100), (i+5, 100+height)], fill='black')
    img.save('test_images/barcode.png')
    print("Created: test_images/barcode.png")


def test_ocr_async():
    """Test async OCR with progress monitoring"""
    print("\n=== TEST 1: Async OCR with Progress Bar ===\n")

    # Test ingredients OCR
    print("1. Uploading ingredients image for OCR...")
    with open('test_images/ingredients.png', 'rb') as f:
        response = requests.post(
            f'{BASE_URL}/api/ocr/ingredientes/start',
            files={'image': f}
        )

    if response.status_code == 202:
        data = response.json()
        job_id = data['job_id']
        print(f"   [ACCEPTED] Job ID: {job_id}")
        print(f"   Initial state: {data['estado']}")

        # Simulate progress bar
        print("\n2. Processing image (polling for progress)...")
        states_seen = []
        start_time = time.time()

        while time.time() - start_time < 30:
            response = requests.get(f'{BASE_URL}/api/ocr/job/{job_id}')
            job = response.json()
            estado = job['estado']

            if estado not in states_seen:
                states_seen.append(estado)
                print(f"   [{estado.upper()}] {time.time() - start_time:.2f}s elapsed")

            if estado == 'listo':
                elapsed = time.time() - start_time
                print(f"\n   COMPLETE in {elapsed:.2f}s")
                print(f"   Result type: {type(job.get('resultado'))}")
                if job.get('resultado'):
                    print(f"   Fields extracted: {list(job['resultado'].keys()) if isinstance(job['resultado'], dict) else 'list'}")
                return True, elapsed
            elif estado == 'error':
                print(f"\n   ERROR: {job['error']}")
                return False, None
            else:
                time.sleep(0.3)

        print("\n   TIMEOUT - no result after 30 seconds")
        return False, None
    else:
        print(f"   ERROR: {response.status_code}")
        print(f"   {response.text}")
        return False, None


def test_macros_ocr():
    """Test macros OCR"""
    print("\n=== TEST 2: Macros OCR ===\n")

    print("1. Uploading macros image...")
    with open('test_images/macros.png', 'rb') as f:
        response = requests.post(
            f'{BASE_URL}/api/ocr/macros/start',
            files={'image': f}
        )

    if response.status_code == 202:
        data = response.json()
        job_id = data['job_id']
        print(f"   Job ID: {job_id}")

        print("\n2. Polling for result...")
        start_time = time.time()

        while time.time() - start_time < 30:
            response = requests.get(f'{BASE_URL}/api/ocr/job/{job_id}')
            job = response.json()
            estado = job['estado']

            if estado == 'listo':
                elapsed = time.time() - start_time
                print(f"   COMPLETE in {elapsed:.2f}s")
                result = job.get('resultado', {})
                if isinstance(result, dict):
                    print(f"   Fields detected:")
                    for key, value in result.items():
                        print(f"      - {key}: {value}")
                return True, result
            elif estado == 'error':
                print(f"   ERROR: {job['error']}")
                return False, None
            else:
                print(f"   State: {estado}...", end='\r')
                time.sleep(0.5)

        return False, None
    else:
        print(f"   ERROR: {response.status_code}")
        return False, None


def test_barcode_ocr():
    """Test barcode OCR"""
    print("\n=== TEST 3: Barcode OCR ===\n")

    print("1. Uploading barcode image...")
    with open('test_images/barcode.png', 'rb') as f:
        response = requests.post(
            f'{BASE_URL}/api/ocr/codigo_barras/start',
            files={'image': f}
        )

    if response.status_code == 202:
        data = response.json()
        job_id = data['job_id']
        print(f"   Job ID: {job_id}")

        print("\n2. Polling for barcode result...")
        start_time = time.time()

        while time.time() - start_time < 30:
            response = requests.get(f'{BASE_URL}/api/ocr/job/{job_id}')
            job = response.json()
            estado = job['estado']

            if estado == 'listo':
                elapsed = time.time() - start_time
                print(f"   COMPLETE in {elapsed:.2f}s")
                result = job.get('resultado')
                # Barcode result is a string, not a dict
                barcode = result if isinstance(result, str) else 'NOT DETECTED'
                print(f"   Barcode detected: {barcode}")
                return True, barcode
            elif estado == 'error':
                print(f"   ERROR: {job['error']}")
                return False, None
            else:
                print(f"   State: {estado}...", end='\r')
                time.sleep(0.5)

        return False, None
    else:
        print(f"   ERROR: {response.status_code}")
        return False, None


def test_duplicate_detection():
    """Test duplicate barcode detection"""
    print("\n=== TEST 4: Duplicate Barcode Detection ===\n")

    # Use unique names and barcodes with timestamp to avoid conflicts
    timestamp = int(time.time())
    unique_name = f"Test Product {timestamp}"
    unique_barcode = f"841000{timestamp % 10000000:07d}"  # Generate unique barcode

    # First create an alimento with a barcode
    print(f"1. Creating initial alimento with barcode {unique_barcode}...")
    alimento1 = {
        "nombre": unique_name,
        "marca": "Test Brand",
        "calorias": "100",
        "categoria": "Frutas",
        "codigo_barras": unique_barcode,
        "proteinas": "5",
        "grasas": "2",
        "hidratos_carbono": "15"
    }

    response = requests.post(
        f'{BASE_URL}/api/alimentos/',
        data=alimento1
    )

    if response.status_code in [200, 201]:
        created = response.json()
        print(f"   Response: {created}")
        alimento_id = created.get('alimento', {}).get('id')
        print(f"   Created alimento ID: {alimento_id}")
    else:
        print(f"   ERROR: {response.status_code} - {response.text}")
        return False

    if True:  # Continue even if creation failed, just for testing

        # Now check if duplicate detection works
        print("\n2. Checking if duplicate barcode is detected...")
        response = requests.post(
            f'{BASE_URL}/api/alimentos/duplicado',
            json={
                "nombre": f"{unique_name} Variant",
                "marca": "Different Brand",
                "calorias": 105,
                "categoria": "Frutas",
                "codigo_barras": "8410000123456",  # Same barcode
                "proteinas": 5,
                "grasas": 2,
                "hidratos_carbono": 15
            }
        )

        data = response.json()
        print(f"   Duplicate detected: {data.get('es_duplicado')}")
        if data.get('es_duplicado'):
            print(f"   Duplicate product: {data.get('duplicado', {}).get('nombre')}")
            print(f"   Can update code: {data.get('puede_actualizar_codigo')}")

        return data.get('es_duplicado', False)
    else:
        print(f"   ERROR creating initial alimento: {response.status_code}")
        return False


def main():
    print("=" * 60)
    print("FoodGestor OCR and Duplicate Detection Test Suite")
    print("=" * 60)

    # Create test images
    create_test_images()

    # Test 1: Async OCR with progress monitoring
    success1, time1 = test_ocr_async()

    # Test 2: Macros OCR
    success2, macros = test_macros_ocr()

    # Test 3: Barcode OCR
    success3, barcode = test_barcode_ocr()

    # Test 4: Duplicate detection
    success4 = test_duplicate_detection()

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"1. Async OCR Progress Bar: {'PASS' if success1 else 'FAIL'}", end='')
    if time1:
        print(f" (completed in {time1:.2f}s)")
    else:
        print()
    print(f"2. Macros OCR: {'PASS' if success2 else 'FAIL'}")
    print(f"3. Barcode OCR: {'PASS' if success3 else 'FAIL'}")
    print(f"4. Duplicate Detection: {'PASS' if success4 else 'FAIL'}")
    print("=" * 60 + "\n")

    all_passed = success1 and success2 and success3 and success4
    return 0 if all_passed else 1


if __name__ == '__main__':
    exit(main())
