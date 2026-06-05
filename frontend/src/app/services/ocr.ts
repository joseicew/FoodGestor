import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  // Tesseract.js no instalado - OCR local desactivado.
  // Alternativas: Tesseract.js (lento), Google Vision API (pago), Claude Vision (sin créditos).

  async leerIngredientes(file: File): Promise<string[]> {
    return [];
  }

  async leerMacros(file: File): Promise<Record<string, number>> {
    return {};
  }
}
