import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const OCR_URL = `${environment.apiUrl}/api/ocr`;

@Injectable({
  providedIn: 'root',
})
export class AiVisionService {
  constructor(private http: HttpClient) {}

  async procesarImagenIngredientes(file: File): Promise<string[]> {
    const formData = new FormData();
    formData.append('imagen', file);
    const res: any = await firstValueFrom(
      this.http.post(`${OCR_URL}/ingredientes`, formData)
    );
    return res.ingredientes ?? [];
  }

  async procesarImagenCodigoBarras(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('imagen', file);
    const res: any = await firstValueFrom(
      this.http.post(`${OCR_URL}/codigo_barras`, formData)
    );
    return res.codigo_barras ?? '';
  }

  async procesarImagenMacros(file: File): Promise<MacrosExtraidos> {
    const formData = new FormData();
    formData.append('imagen', file);
    const res: any = await firstValueFrom(
      this.http.post(`${OCR_URL}/macros`, formData)
    );
    return res.macros ?? {};
  }

  async procesarImagenCompleta(file: File): Promise<DatosProductoExtraidos> {
    const formData = new FormData();
    formData.append('imagen', file);
    const res: any = await firstValueFrom(
      this.http.post(`${OCR_URL}/datos-completos`, formData)
    );
    return res.datos ?? {};
  }
}

export interface MacrosExtraidos {
  calorias?: number;
  proteinas?: number;
  hidratos_carbono?: number;
  azucares?: number;
  grasas?: number;
  grasas_saturadas?: number;
  fibra?: number;
  sal?: number;
  sodio?: number;
}

export interface DatosProductoExtraidos {
  nombre?: string;
  marca?: string;
  categoria?: string;
  codigo_barras?: string;
  ingredientes?: string[];
  macros?: MacrosExtraidos;
  minerales?: MineralesExtraidos;
  peso_unidad?: number;
  nombre_unidad?: string;
}

export interface MineralesExtraidos {
  sodio?: number;
  potasio?: number;
  calcio?: number;
  hierro?: number;
}
