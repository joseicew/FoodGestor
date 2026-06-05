#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para crear automáticamente el workflow de n8n que procesa ingredientes.
Ejecutar: python setup_n8n_workflow.py
"""

import requests
import json
import time
import sys
import io

# Configurar encoding de salida para Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

N8N_BASE_URL = "http://localhost:5678/api/v1"
WORKFLOW_NAME = "FoodGestor - Procesar Ingredientes"

# Estructura del workflow con nodos
WORKFLOW_DEFINITION = {
    "name": WORKFLOW_NAME,
    "nodes": [
        {
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "procesar-ingrediente",
                "responseCode": 200,
                "options": {}
            }
        },
        {
            "name": "Set - Default Response",
            "type": "n8n-nodes-base.set",
            "position": [500, 300],
            "parameters": {
                "assignments": {
                    "assignments": [
                        {
                            "name": "nombre",
                            "value": "={{ $json.nombre }}"
                        },
                        {
                            "name": "descripcion",
                            "value": ""
                        },
                        {
                            "name": "alergias",
                            "value": ""
                        },
                        {
                            "name": "intolerancias",
                            "value": ""
                        },
                        {
                            "name": "tipo",
                            "value": ""
                        },
                        {
                            "name": "origen",
                            "value": ""
                        },
                        {
                            "name": "organico",
                            "value": False
                        },
                        {
                            "name": "notas",
                            "value": "Información no disponible - Retornando valores por defecto"
                        }
                    ]
                }
            }
        },
        {
            "name": "HTTP Request - OpenFoodFacts",
            "type": "n8n-nodes-base.httpRequest",
            "position": [750, 200],
            "parameters": {
                "url": "https://world.openfoodfacts.org/cgi/search.pl",
                "method": "GET",
                "qs": True,
                "queryParameters": "search_terms={{ $json.nombre }}&json=1",
                "options": {}
            }
        },
        {
            "name": "Response",
            "type": "n8n-nodes-base.respondToWebhook",
            "position": [1000, 300],
            "parameters": {
                "responseCode": 200
            }
        }
    ],
    "connections": {
        "Webhook": {
            "main": [
                [
                    {
                        "node": "Set - Default Response",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        },
        "Set - Default Response": {
            "main": [
                [
                    {
                        "node": "Response",
                        "type": "main",
                        "index": 0
                    }
                ]
            ]
        }
    },
    "active": True,
    "settings": {}
}

def create_workflow():
    """Crear workflow en n8n"""
    try:
        print("🔧 Intentando crear workflow en n8n...")
        print(f"   URL: {N8N_BASE_URL}/workflows")

        response = requests.post(
            f"{N8N_BASE_URL}/workflows",
            json=WORKFLOW_DEFINITION,
            timeout=10
        )

        print(f"   Status: {response.status_code}")

        if response.status_code in [200, 201]:
            data = response.json()
            workflow_id = data.get("id")
            print(f"✅ Workflow creado exitosamente!")
            print(f"   ID: {workflow_id}")
            print(f"   Nombre: {WORKFLOW_NAME}")
            return workflow_id
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except requests.exceptions.ConnectionError:
        print("❌ No se puede conectar a n8n en http://localhost:5678")
        print("   ¿n8n está corriendo? Ejecuta: n8n start")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def get_webhook_url():
    """Obtener URL del webhook"""
    try:
        # Obtener lista de workflows
        response = requests.get(
            f"{N8N_BASE_URL}/workflows",
            timeout=10
        )

        if response.status_code == 200:
            workflows = response.json()

            # Buscar el workflow que creamos
            for workflow in workflows.get("data", []):
                if workflow.get("name") == WORKFLOW_NAME:
                    workflow_id = workflow.get("id")
                    webhook_url = f"http://localhost:5678/webhook/procesar-ingrediente"
                    print(f"✅ Webhook URL encontrada:")
                    print(f"   {webhook_url}")
                    return webhook_url

            print("⚠️  Workflow no encontrado en la lista")
            return None
        else:
            print(f"❌ Error al obtener workflows: {response.status_code}")
            return None

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None


def test_webhook(ingredient_name="Nuez"):
    """Probar el webhook"""
    try:
        print(f"\n🧪 Probando webhook con ingrediente: {ingredient_name}")

        response = requests.post(
            "http://localhost:5678/webhook/procesar-ingrediente",
            json={"nombre": ingredient_name},
            timeout=10
        )

        print(f"   Status: {response.status_code}")

        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Respuesta recibida:")
            print(f"   {json.dumps(data, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error en la prueba: {str(e)}")
        return False


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 SETUP DE WORKFLOW N8N - FOODGESTOR")
    print("="*60 + "\n")

    # Crear workflow
    print("📦 Paso 1: Crear workflow")
    print("-" * 60)
    workflow_id = create_workflow()

    if workflow_id:
        time.sleep(2)

        # Obtener URL del webhook
        print("\n🔗 Paso 2: Obtener URL del webhook")
        print("-" * 60)
        webhook_url = get_webhook_url()

        if webhook_url:
            time.sleep(2)

            # Probar webhook
            print("\n🧪 Paso 3: Probar webhook")
            print("-" * 60)
            test_webhook("Nuez")
            test_webhook("Leche")

            print("\n" + "="*60)
            print("✅ CONFIGURACIÓN COMPLETADA")
            print("="*60)
            print(f"\n📋 Información importante:")
            print(f"   • n8n Dashboard: http://localhost:5678")
            print(f"   • Webhook URL: {webhook_url}")
            print(f"   • Workflow ID: {workflow_id}")
            print(f"\n🔄 Próximos pasos:")
            print(f"   1. Actualizar .env con:")
            print(f"      N8N_WEBHOOK_INGREDIENTES={webhook_url}")
            print(f"   2. Reiniciar Flask backend")
            print(f"   3. Ejecutar: POST /api/alimentos/ingredientes/procesar-todos")
        else:
            print("❌ No se pudo obtener la URL del webhook")
    else:
        print("❌ No se pudo crear el workflow")

    print()
