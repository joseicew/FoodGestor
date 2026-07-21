import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Señala cuando el AuthInterceptor está reintentando una petición porque
 * el backend no respondió (típico "cold start" del plan gratuito de
 * Render tras ~15 min sin tráfico). Permite mostrar un aviso global sin
 * acoplar el interceptor a ningún componente concreto.
 */
@Injectable({ providedIn: 'root' })
export class ServerWakeupService {
  private despertandoSubject = new BehaviorSubject<boolean>(false);
  despertando$ = this.despertandoSubject.asObservable();

  marcarDespertando(): void {
    this.despertandoSubject.next(true);
  }

  marcarListo(): void {
    this.despertandoSubject.next(false);
  }
}
