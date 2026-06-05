import { Injectable } from '@angular/core';

interface OcrJob {
  job_id: string;
  estado: 'pendiente' | 'procesando' | 'listo' | 'error';
  resultado?: any;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OcrAsyncService {
  private pollInterval = 500; // ms entre sondeos
  private maxWaitTime = 120000; // 2 minutos de timeout

  iniciarOcrIngredientes(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    return this.iniciarOcr('/api/ocr/ingredientes/start', formData);
  }

  iniciarOcrMacros(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    return this.iniciarOcr('/api/ocr/macros/start', formData);
  }

  iniciarOcrCodigoBarras(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    return this.iniciarOcr('/api/ocr/codigo_barras/start', formData);
  }

  private async iniciarOcr(endpoint: string, formData: FormData): Promise<string> {
    // Usar URL absoluta del backend
    const backendUrl = `http://192.168.1.17:5000${endpoint}`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Error al iniciar OCR: ${response.statusText}`);
    }

    const data = await response.json();
    return data.job_id;
  }

  /**
   * Espera a que un job se complete y retorna el resultado.
   * Ejecuta polling periódico para verificar el estado.
   */
  async esperarResultado(jobId: string, onProgress?: (estado: string) => void): Promise<any> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() - startTime > this.maxWaitTime) {
          reject(new Error('Timeout esperando resultado del OCR'));
          return;
        }

        try {
          const response = await fetch(`http://192.168.1.17:5000/api/ocr/job/${jobId}`);
          if (!response.ok) {
            reject(new Error('Job no encontrado'));
            return;
          }

          const job: OcrJob = await response.json();

          onProgress?.(job.estado);

          if (job.estado === 'listo') {
            resolve(job.resultado);
          } else if (job.estado === 'error') {
            reject(new Error(job.error || 'Error desconocido en OCR'));
          } else {
            // Continuar polling
            setTimeout(poll, this.pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}
