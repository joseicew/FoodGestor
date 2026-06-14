import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface QueuedOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  entity: 'racion' | 'alimento' | 'comida';
  data: any;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

@Injectable({
  providedIn: 'root'
})
export class OperationQueueService {
  private queue: QueuedOperation[] = [];
  private queueSubject = new Subject<QueuedOperation[]>();
  public queue$ = this.queueSubject.asObservable();

  private readonly QUEUE_KEY = 'operation_queue';
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.loadQueueFromStorage();
  }

  /**
   * Agrega una operación a la cola
   */
  enqueue(
    type: 'add' | 'update' | 'delete',
    entity: 'racion' | 'alimento' | 'comida',
    data: any
  ): QueuedOperation {
    const operation: QueuedOperation = {
      id: `${entity}_${Date.now()}_${Math.random()}`,
      type,
      entity,
      data,
      timestamp: new Date(),
      retries: 0,
      maxRetries: this.MAX_RETRIES
    };

    this.queue.push(operation);
    this.saveQueueToStorage();
    this.notifyQueueChanged();

    console.log(`📋 Operación encolada (${this.queue.length} pendientes):`, operation);

    return operation;
  }

  /**
   * Obtiene y elimina la siguiente operación de la cola
   */
  dequeue(): QueuedOperation | undefined {
    const operation = this.queue.shift();
    if (operation) {
      this.saveQueueToStorage();
      this.notifyQueueChanged();
      console.log(`✅ Operación deencolada, ${this.queue.length} pendientes`);
    }
    return operation;
  }

  /**
   * Retorna la próxima operación sin eliminarla
   */
  peek(): QueuedOperation | undefined {
    return this.queue[0];
  }

  /**
   * Incrementa reintentos de una operación
   */
  incrementRetries(operationId: string): boolean {
    const operation = this.queue.find(op => op.id === operationId);
    if (operation) {
      operation.retries++;
      this.saveQueueToStorage();

      if (operation.retries >= operation.maxRetries) {
        console.error(`❌ Máximo de reintentos alcanzado para ${operationId}`);
        return false;
      }

      return true;
    }
    return false;
  }

  /**
   * Elimina una operación específica
   */
  remove(operationId: string): boolean {
    const index = this.queue.findIndex(op => op.id === operationId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveQueueToStorage();
      this.notifyQueueChanged();
      console.log(`🗑️ Operación eliminada de la cola`);
      return true;
    }
    return false;
  }

  /**
   * Obtiene el tamaño de la cola
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Verifica si la cola está vacía
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Obtiene toda la cola
   */
  getAll(): QueuedOperation[] {
    return [...this.queue];
  }

  /**
   * Limpia toda la cola
   */
  clear(): void {
    this.queue = [];
    this.saveQueueToStorage();
    this.notifyQueueChanged();
    console.log('🗑️ Cola de operaciones limpiada');
  }

  /**
   * Obtiene operaciones por tipo
   */
  getByType(type: 'add' | 'update' | 'delete'): QueuedOperation[] {
    return this.queue.filter(op => op.type === type);
  }

  /**
   * Obtiene operaciones por entidad
   */
  getByEntity(entity: 'racion' | 'alimento' | 'comida'): QueuedOperation[] {
    return this.queue.filter(op => op.entity === entity);
  }

  /**
   * Guarda la cola en localStorage
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Error guardando cola:', e);
    }
  }

  /**
   * Carga la cola desde localStorage
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`📋 Restaurados ${this.queue.length} operaciones pendientes`);
        this.notifyQueueChanged();
      }
    } catch (e) {
      console.error('Error cargando cola:', e);
      this.queue = [];
    }
  }

  /**
   * Notifica cambios en la cola
   */
  private notifyQueueChanged(): void {
    this.queueSubject.next([...this.queue]);
  }

  /**
   * Genera reporte de la cola
   */
  getReport(): string {
    const adds = this.queue.filter(op => op.type === 'add').length;
    const updates = this.queue.filter(op => op.type === 'update').length;
    const deletes = this.queue.filter(op => op.type === 'delete').length;

    return `Cola: ${this.queue.length} ops (➕${adds} 📝${updates} 🗑️${deletes})`;
  }
}
