import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DebugService {
  checkLocalStorage(): void {
    console.log('=== VERIFICACIÓN DE LOCALSTORAGE ===');
    console.log('auth_token:', !!localStorage.getItem('auth_token'));
    console.log('Token valor (primeros 20 chars):', localStorage.getItem('auth_token')?.substring(0, 20));
    console.log('Todas las keys en localStorage:', Object.keys(localStorage));
    console.log('===============================');
  }
}
