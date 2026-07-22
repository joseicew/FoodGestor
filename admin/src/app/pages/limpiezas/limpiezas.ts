import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ApiService, TipoLimpieza } from '../../services/api';
import { AlimentoModalComponent } from '../../components/alimento-modal/alimento-modal';

interface EstadoLimpieza {
  info: TipoLimpieza;
  ejecutando: boolean;
  expandido: boolean;
  resultado: any | null;
  error: string | null;
  jobId: string | null;
}

const ICONOS_TIPO: Record<string, string> = {
  huerfanos: '🗑️',
  duplicados: '🔗',
  sin_categoria: '🏷️',
  alergenos_faltantes: '⚠️',
  compuestos_descripciones: '✂️',
  aditivos_sin_nota: '🧪',
  sin_ingredientes: '🍽️',
  alimentos_duplicados: '📦',
};

@Component({
  selector: 'app-limpiezas',
  standalone: true,
  imports: [CommonModule, AlimentoModalComponent],
  template: `
    <header class="page-head">
      <h2>🧹 Limpiezas</h2>
      <p>Automatiza las limpiezas de la base de datos de ingredientes que se hicieron manualmente. Cada tarjeta lanza un agente que revisa y aplica los cambios; el detalle de cada acción queda abajo para su revisión.</p>
    </header>

    @if (cargando) {
      <div class="estado-carga">
        <span class="spinner"></span>
        <span>Cargando tipos de limpieza...</span>
      </div>
    } @else if (errorCarga) {
      <div class="aviso error">⚠️ {{ errorCarga }}</div>
    } @else {
      <div class="limpiezas-grid">
        @for (item of estados; track item.info.tipo) {
          <div class="card limpieza-card" [class.al-dia]="item.info.pendientes === 0">
            <div class="limpieza-cabecera">
              <div class="limpieza-icono">{{ iconoDe(item.info.tipo) }}</div>
              <div class="limpieza-titulo-wrap">
                <div class="limpieza-titulo">
                  <h3>{{ item.info.nombre }}</h3>
                  @if (item.info.ia) { <span class="badge badge-primary">✨ Agente IA</span> }
                </div>
                <p class="limpieza-desc">{{ item.info.descripcion }}</p>
              </div>
            </div>

            <div class="limpieza-pie">
              <span class="pill" [class.pill-ok]="item.info.pendientes === 0" [class.pill-pendiente]="item.info.pendientes > 0">
                {{ item.info.pendientes === 0 ? '✓ al día' : item.info.pendientes + ' pendiente(s)' }}
              </span>

              <div class="limpieza-acciones">
                @if (item.resultado) {
                  <button class="btn btn-ghost" (click)="item.expandido = !item.expandido">
                    {{ item.expandido ? 'Ocultar detalle' : 'Ver detalle' }}
                  </button>
                }
                <button class="btn btn-primary" (click)="ejecutar(item)"
                        [disabled]="item.ejecutando || item.info.pendientes === 0">
                  @if (item.ejecutando) {
                    <span class="spinner spinner-sm"></span> Ejecutando...
                  } @else {
                    ▶ Ejecutar
                  }
                </button>
              </div>
            </div>

            @if (item.error) {
              <div class="aviso error">⚠️ {{ item.error }}</div>
            }

            @if (item.resultado) {
              <div class="resumen-resultado">
                @if (item.resultado.resumen) {
                  <span class="stat-chip stat-ok">✅ {{ item.resultado.resumen.aplicados }} aplicados</span>
                  <span class="stat-chip stat-neutral">⏭️ {{ item.resultado.resumen.omitidos }} omitidos</span>
                  @if (item.resultado.resumen.errores > 0) {
                    <span class="stat-chip stat-error">⛔ {{ item.resultado.resumen.errores }} con error</span>
                  }
                } @else {
                  <p class="sin-uso">{{ item.resultado.mensaje || ('Ingredientes afectados: ' + (item.resultado.cantidad_eliminados ?? item.resultado.total_eliminados ?? 0)) }}</p>
                }
              </div>

              @if (item.expandido && item.resultado.acciones?.length) {
                <div class="detalle-acciones">
                  @for (accion of item.resultado.acciones; track accion.id) {
                    <div class="accion-fila">
                      <span class="accion-icono">
                        {{ accion.resultado === 'aplicado' ? '✅' : accion.resultado === 'error' ? '⛔' : '⏭️' }}
                      </span>
                      <span class="accion-nombre">{{ accion.nombre }}</span>
                      <span class="accion-detalle">{{ accion.detalle || accion.motivo }}</span>
                    </div>
                  }
                </div>
              }

              @if (item.expandido && item.resultado.consolidaciones?.length) {
                <div class="detalle-acciones">
                  @for (c of item.resultado.consolidaciones; track c.duplicado_id) {
                    <div class="accion-fila">
                      <span class="accion-icono">✅</span>
                      <span class="accion-nombre">{{ c.duplicado_nombre }}</span>
                      <span class="accion-detalle">fusionado con "{{ c.principal_nombre }}" ({{ c.alimentos_transferidos }} alimento(s) transferidos)</span>
                    </div>
                  }
                </div>
              }

              @if (item.expandido && item.resultado.ingredientes?.length && !item.resultado.acciones && !item.resultado.consolidaciones) {
                <div class="detalle-acciones">
                  @for (nombre of item.resultado.ingredientes; track nombre) {
                    <div class="accion-fila">
                      <span class="accion-icono">✅</span>
                      <span class="accion-nombre">{{ nombre }}</span>
                      <span class="accion-detalle">eliminado</span>
                    </div>
                  }
                </div>
              }

              @if (item.expandido && item.resultado.alimentos?.length) {
                <div class="detalle-acciones">
                  @for (a of item.resultado.alimentos; track a.id) {
                    <div class="accion-fila accion-fila-sin-ing">
                      <button type="button" class="accion-fila-click" (click)="editarAlimento(a.id)">
                        <span class="accion-icono">🍽️</span>
                        <span class="accion-nombre">{{ a.nombre }}</span>
                        <span class="accion-detalle">{{ a.marca || 'Sin marca' }} · click para editar</span>
                      </button>
                      @if (a.ingrediente_sugerido) {
                        <button type="button" class="btn btn-sugerido"
                                (click)="vincularSugerido(item, a)" [disabled]="vinculando === a.id"
                                title="El alimento y el ingrediente parecen ser lo mismo (mismo nombre)">
                          {{ vinculando === a.id ? '...' : '✅ ¿Es "' + a.ingrediente_sugerido.nombre + '"?' }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              @if (item.expandido && item.resultado.grupos?.length) {
                <div class="grupos-duplicados">
                  @for (grupo of item.resultado.grupos; track $index) {
                    <div class="grupo-duplicado">
                      <span class="grupo-etiqueta">{{ etiquetaCriterio(grupo.criterio) }}</span>
                      @for (a of grupo.alimentos; track a.id) {
                        <button type="button" class="accion-fila-click grupo-item" (click)="editarAlimento(a.id)">
                          <span class="accion-nombre">{{ a.nombre }}</span>
                          <span class="accion-detalle">
                            {{ a.marca || 'Sin marca' }} · {{ a.calorias ?? '?' }} kcal · P {{ a.proteinas ?? '?' }} · G {{ a.grasas ?? '?' }} · HC {{ a.hidratos_carbono ?? '?' }}
                          </span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        }
      </div>
    }

    @if (alimentoModalId) {
      <app-alimento-modal
        [alimentoId]="alimentoModalId"
        [seccionesResaltadas]="['ingredientes']"
        (cerrar)="cerrarAlimentoModal()"
        (guardado)="onAlimentoGuardado()">
      </app-alimento-modal>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 20px; }
    .page-head h2 { font-size: 22px; font-weight: 700; }
    .page-head p { color: var(--text-muted); margin: 4px 0 0; max-width: 720px; }

    .estado-carga { display: flex; align-items: center; gap: 10px; color: var(--text-muted); padding: 24px 0; }

    .spinner {
      display: inline-block; width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid var(--border); border-top-color: var(--primary);
      animation: spin 0.7s linear infinite;
    }
    .spinner-sm { width: 13px; height: 13px; border-width: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .limpiezas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 18px;
      align-items: start;
    }

    .limpieza-card {
      display: flex; flex-direction: column; gap: 14px; padding: 18px;
      border-left: 3px solid var(--primary);
      transition: box-shadow 0.15s, transform 0.15s;
    }
    .limpieza-card:hover { box-shadow: 0 4px 14px rgba(16, 24, 40, 0.10); transform: translateY(-1px); }
    .limpieza-card.al-dia { border-left-color: var(--border); opacity: 0.85; }

    .limpieza-cabecera { display: flex; gap: 12px; align-items: flex-start; }
    .limpieza-icono {
      flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
      background: var(--primary-soft); display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .limpieza-titulo-wrap { flex: 1; min-width: 0; }
    .limpieza-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .limpieza-titulo h3 { margin: 0; font-size: 15px; }
    .limpieza-desc { margin: 4px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.4; }

    .limpieza-pie { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .limpieza-acciones { display: flex; gap: 8px; }

    .pill {
      font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px;
      background: var(--surface-2); color: var(--text-muted); white-space: nowrap;
    }
    .pill-pendiente { background: var(--warning-soft); color: var(--warning); }
    .pill-ok { background: var(--primary-soft); color: var(--primary-dark); }

    .btn-ghost { background: transparent; border-color: transparent; }
    .btn-ghost:hover { background: var(--surface-2); }

    .resumen-resultado { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .stat-chip {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700;
      padding: 4px 10px; border-radius: 20px;
    }
    .stat-ok { background: var(--primary-soft); color: var(--primary-dark); }
    .stat-neutral { background: var(--surface-2); color: var(--text-muted); }
    .stat-error { background: var(--danger-soft); color: var(--danger); }
    .sin-uso { margin: 0; color: var(--text-muted); font-size: 13px; }

    .detalle-acciones {
      display: flex; flex-direction: column; max-height: 320px; overflow-y: auto;
      border-top: 1px solid var(--border); padding-top: 6px; margin-top: 2px;
    }
    .accion-fila {
      display: flex; align-items: center; gap: 10px; font-size: 12.5px; padding: 6px 8px; border-radius: 6px;
    }
    .accion-fila:nth-child(odd) { background: var(--surface-2); }
    .accion-fila-sin-ing { gap: 8px; }
    .accion-fila-click { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: none; text-align: left; cursor: pointer; font: inherit; color: inherit; background: transparent; padding: 0; }
    .accion-fila-click:hover { text-decoration: underline; }
    .btn-sugerido { flex-shrink: 0; font-size: 11.5px; padding: 4px 10px; background: var(--warning-soft); color: var(--warning); border-color: var(--warning); }
    .btn-sugerido:hover:not(:disabled) { background: var(--warning); color: #fff; }

    .grupos-duplicados {
      display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto;
      border-top: 1px solid var(--border); padding-top: 10px; margin-top: 2px;
    }
    .grupo-duplicado {
      display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--border);
      border-radius: 8px; padding: 8px; background: var(--surface-2);
    }
    .grupo-etiqueta { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .grupo-item { border-radius: 6px; padding: 6px 8px !important; background: var(--surface); }
    .accion-icono { flex-shrink: 0; font-size: 13px; }
    .accion-nombre { font-weight: 600; flex: 1 1 40%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .accion-detalle { color: var(--text-muted); flex: 1 1 55%; min-width: 0; }
  `]
})
export class LimpiezasComponent implements OnInit, OnDestroy {
  estados: EstadoLimpieza[] = [];
  cargando = true;
  errorCarga = '';

  alimentoModalId: number | null = null;
  vinculando: number | null = null;

  private intervalos = new Map<string, any>();

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarTipos();
  }

  ngOnDestroy(): void {
    this.intervalos.forEach((id) => clearInterval(id));
  }

  iconoDe(tipo: string): string {
    return ICONOS_TIPO[tipo] || '🧹';
  }

  cargarTipos(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.api.listarTiposLimpieza().subscribe({
      next: (tipos) => {
        this.estados = tipos.map((info) => ({
          info,
          ejecutando: false,
          expandido: false,
          resultado: null,
          error: null,
          jobId: null,
        }));
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorCarga = err.error?.error || 'No se pudieron cargar las limpiezas disponibles';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  ejecutar(item: EstadoLimpieza): void {
    item.ejecutando = true;
    item.error = null;
    item.resultado = null;

    if (!item.info.ia) {
      const llamadasPorTipo: Record<string, () => Observable<any>> = {
        huerfanos: () => this.api.limpiarHuerfanos(),
        duplicados: () => this.api.consolidarDuplicados(),
        sin_ingredientes: () => this.api.listarAlimentosSinIngredientes(),
        alimentos_duplicados: () => this.api.listarAlimentosDuplicados(),
      };
      const llamada = llamadasPorTipo[item.info.tipo]();

      // "sin_ingredientes" y "alimentos_duplicados" son solo un listado para
      // revisar a mano, no una limpieza automatica: no tocan datos, asi que
      // no se dan por resueltos los pendientes hasta que el admin actue.
      const SOLO_REVISION = new Set(['sin_ingredientes', 'alimentos_duplicados']);
      const marcaComoResuelto = !SOLO_REVISION.has(item.info.tipo);

      llamada.subscribe({
        next: (resultado) => {
          item.ejecutando = false;
          item.resultado = resultado;
          item.expandido = true;
          if (marcaComoResuelto) item.info.pendientes = 0;
          this.cdr.detectChanges();
        },
        error: (err) => {
          item.ejecutando = false;
          item.error = err.error?.error || 'Error al ejecutar la limpieza';
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.api.iniciarLimpieza(item.info.tipo).subscribe({
      next: ({ job_id }) => {
        item.jobId = job_id;
        this.sondearJob(item);
      },
      error: (err) => {
        item.ejecutando = false;
        item.error = err.error?.error || 'Error al lanzar el agente de limpieza';
        this.cdr.detectChanges();
      }
    });
  }

  private sondearJob(item: EstadoLimpieza): void {
    if (!item.jobId) return;
    const jobId = item.jobId;

    const intervalo = setInterval(() => {
      this.api.obtenerJobLimpieza(jobId).subscribe({
        next: (job) => {
          if (job.estado === 'listo') {
            clearInterval(intervalo);
            this.intervalos.delete(jobId);
            item.ejecutando = false;
            item.resultado = job.resultado;
            item.expandido = true;
            if (job.resultado?.resumen) {
              item.info.pendientes = Math.max(0, item.info.pendientes - job.resultado.resumen.aplicados);
            }
            this.cdr.detectChanges();
          } else if (job.estado === 'error') {
            clearInterval(intervalo);
            this.intervalos.delete(jobId);
            item.ejecutando = false;
            item.error = job.error || 'El agente falló durante la limpieza';
            this.cdr.detectChanges();
          }
        },
        error: () => {
          clearInterval(intervalo);
          this.intervalos.delete(jobId);
          item.ejecutando = false;
          item.error = 'Se perdió la conexión con el servidor mientras se ejecutaba la limpieza';
          this.cdr.detectChanges();
        }
      });
    }, 2000);

    this.intervalos.set(jobId, intervalo);
  }

  editarAlimento(id: number): void {
    this.alimentoModalId = id;
  }

  etiquetaCriterio(_criterio: string): string {
    return 'Mismo nombre y marca';
  }

  vincularSugerido(item: EstadoLimpieza, alimento: any): void {
    if (!alimento.ingrediente_sugerido) return;
    this.vinculando = alimento.id;
    this.api.vincularIngredienteSugerido(alimento.id, alimento.ingrediente_sugerido.id).subscribe({
      next: () => {
        this.vinculando = null;
        item.resultado.alimentos = item.resultado.alimentos.filter((a: any) => a.id !== alimento.id);
        item.info.pendientes = Math.max(0, item.info.pendientes - 1);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.vinculando = null;
        item.error = err.error?.error || 'No se pudo vincular el ingrediente';
        this.cdr.detectChanges();
      }
    });
  }

  cerrarAlimentoModal(): void {
    this.alimentoModalId = null;
  }

  onAlimentoGuardado(): void {
    // Tras añadir ingredientes, refrescar el contador de "sin_ingredientes"
    // por si este alimento ya deja de aparecer en la lista.
    const item = this.estados.find((e) => e.info.tipo === 'sin_ingredientes');
    if (item) {
      this.api.listarAlimentosSinIngredientes().subscribe((resultado) => {
        item.resultado = resultado;
        item.info.pendientes = resultado.total ?? 0;
        this.cdr.detectChanges();
      });
    }
  }
}
