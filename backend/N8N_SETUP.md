# N8N Setup para FoodGestor OCR

## Descripción

Este documento explica cómo configurar N8N para procesar OCR de forma asíncrona en FoodGestor.

## Arquitectura Actual

Actualmente, la app usa processing asíncrono nativo de Python con threading:

```
Frontend (Angular)
    ↓ POST /api/ocr/ingredientes/start
Backend (Flask)
    ├─ crea job con ID único
    ├─ inicia thread para procesar
    └─ devuelve job_id
    
Backend (thread separado)
    ├─ valida imagen
    ├─ procesa con Claude Vision
    └─ guarda resultado en job
    
Frontend (polling cada 500ms)
    ├─ GET /api/ocr/job/{job_id}
    └─ muestra progreso hasta que esté listo
```

## Alternativa: N8N

Si quieres escalar a N8N en el futuro, sigue estos pasos:

### 1. Instalar N8N

```bash
npm install -g n8n
n8n start
```

O con Docker:

```bash
docker run -it --rm --name n8n -p 5678:5678 -e N8N_HOST=localhost n8nio/n8n
```

### 2. Crear Workflow en N8N

En N8N, crea un workflow nuevo con estos nodos:

#### Nodo 1: HTTP Request (Trigger)
- **Method**: POST
- **URL**: http://localhost:5678/webhook/foodgestor-ocr
- **Authentication**: None

Este nodo recibe la solicitud del frontend.

#### Nodo 2: Set (Procesar datos)
```json
{
  "jobId": "{{ $node[\"HTTP Request\"].json.jobId }}",
  "tipo": "{{ $node[\"HTTP Request\"].json.tipo }}",
  "imagen_base64": "{{ $node[\"HTTP Request\"].json.imagen_base64 }}"
}
```

#### Nodo 3: HTTP Request (a Claude API)
- **Method**: POST
- **URL**: https://api.anthropic.com/v1/messages
- **Headers**:
  - `x-api-key`: {{ $env.ANTHROPIC_API_KEY }}
  - `anthropic-version`: 2023-06-01

**Body**:
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": "{{ $node[\"Set\"].json.imagen_base64 }}"
          }
        },
        {
          "type": "text",
          "text": "{{ $node[\"Set\"].json.prompt }}"
        }
      ]
    }
  ]
}
```

#### Nodo 4: HTTP Request (POST a webhook del backend)
- **Method**: POST
- **URL**: http://localhost:3000/api/ocr/webhook/resultado
- **Body**:
```json
{
  "jobId": "{{ $node[\"Set\"].json.jobId }}",
  "resultado": "{{ $node[\"HTTP Request\"].json.content[0].text }}"
}
```

### 3. Actualizar Backend para N8N

Crea un endpoint en `app/routes/ocr_async.py`:

```python
@ocr_async_bp.route('/webhook/resultado', methods=['POST'])
def recibir_resultado_n8n():
    """Recibe resultados de N8N y actualiza el job"""
    try:
        data = request.get_json()
        job_id = data.get('jobId')
        resultado = data.get('resultado')
        
        actualizar_job(job_id, JobStatus.LISTO, resultado=resultado)
        
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 4. Cambiar Frontend a N8N

En `alimentos.ts`, actualiza el servicio OCR:

```typescript
// Cambiar a N8N
usarOcrAsincrono = true;
usarN8n = true; // Nueva variable

// En onFotoIngredientes:
const jobId = await this.ocrAsync.iniciarOcrIngredientesN8n(input.files[0]);
```

## Ventajas de N8N vs Threading

| Aspecto | Threading | N8N |
|--------|-----------|-----|
| **Setup** | Ya implementado ✅ | Requiere instalación |
| **Escalabilidad** | Limitado a recursos del servidor | Distribuido, escalable |
| **Monitoreo** | Logfiles | Dashboard visual |
| **Reintentos** | Manual | Automático |
| **Costo** | Gratis | Gratis (self-hosted) |
| **Latencia** | ~2-4s | ~2-4s + overhead N8N |

## Recomendación

Para FoodGestor actualmente:
- ✅ **Usa threading** (ya implementado) - es más simple y suficiente
- 📊 **Considera N8N** si escalas a múltiples servidores o necesitas monitoreo avanzado

## Testing

Para probar la solución actual (sin N8N):

```bash
# Terminal 1: Backend
python main.py

# Terminal 2: Frontend
ng serve

# Frontend: Sube una foto y verifica:
# 1. Estado "procesando..." en overlay
# 2. Campos se rellenan cuando está listo
# 3. Log en console de polling cada 500ms
```

