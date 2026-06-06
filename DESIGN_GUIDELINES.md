# 🎨 FoodGestor - Pautas de Diseño y Arquitectura

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Componentes Angular](#componentes-angular)
4. [Estilos CSS](#estilos-css)
5. [Convenciones de Código](#convenciones-de-código)
6. [Patrones de Desarrollo](#patrones-de-desarrollo)
7. [API Backend](#api-backend)
8. [Base de Datos](#base-de-datos)

---

## 🎯 Visión General

**FoodGestor** es una aplicación nutricional que permite a los usuarios:
- 📱 Gestionar alimentos y sus propiedades nutricionales
- 🍽️ Crear y organizar raciones diarias
- 📊 Seguimiento del calendario de comidas
- ⚠️ Identificar alergenos en ingredientes

**Modelo de Despliegue:**
- Frontend: Angular 21 (Standalone Components)
- Backend: Flask REST API
- Database: SQLite
- Access: Web Browser (PWA compatible)

---

## 🏗️ Arquitectura

### Stack Tecnológico

```
┌─────────────────────────────────────────┐
│         Frontend (Angular 21)            │
│  - Standalone Components                 │
│  - Reactive Forms (FormsModule)          │
│  - HTTP Client + Interceptors            │
└──────────────┬──────────────────────────┘
               │
        HTTP (JSON-REST)
               │
┌──────────────▼──────────────────────────┐
│      Backend (Flask)                    │
│  - SQLAlchemy ORM                       │
│  - JWT Authentication                   │
│  - Blueprint-based routes               │
└──────────────┬──────────────────────────┘
               │
        SQL Queries
               │
┌──────────────▼──────────────────────────┐
│    Database (SQLite)                    │
│  - Users, Ingredients, Recipes          │
│  - Daily Tracking                       │
└─────────────────────────────────────────┘
```

### Carpetas Principales

```
FoodGestor/
├── backend/                    # Flask API
│   ├── app/
│   │   ├── models/            # SQLAlchemy models
│   │   ├── routes/            # API endpoints
│   │   └── __init__.py        # App factory
│   ├── main.py                # Entry point
│   └── requirements.txt        # Dependencies
│
├── frontend/                   # Angular app
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # UI components
│   │   │   ├── services/      # HTTP services
│   │   │   ├── guards/        # Route guards
│   │   │   ├── interceptors/  # HTTP interceptors
│   │   │   └── styles.css     # Global styles
│   │   └── index.html
│   └── angular.json
│
└── README.md                   # Setup instructions
```

---

## 🧩 Componentes Angular

### Estructura de Componentes

Cada componente sigue este patrón:

```typescript
// component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-component-name',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './component.html',
  styleUrl: './component.css'
})
export class ComponentNameComponent implements OnInit {
  
  // Properties
  data: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(private service: SomeService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // Logic here
  }
}
```

### Componentes Principales

| Componente | Propósito | Responsabilidad |
|-----------|-----------|-----------------|
| **Alimentos** | Gestión de alimentos | CRUD de alimentos, búsqueda, filtros |
| **Raciones** | Gestión de raciones | Crear/editar raciones, ingredientes |
| **Calendario** | Historial nutricional | Mostrar seguimiento diario, gráficos |
| **Perfil** | Datos del usuario | Info personal, límites nutricionales |
| **Login/Registro** | Autenticación | Auth con JWT |

### Patrón de Servicio

```typescript
// service.ts
@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders() {
    const token = this.authService.obtenerToken();
    return { headers: new HttpHeaders({
      'Authorization': `Bearer ${token}`
    })};
  }

  obtenerDatos(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/endpoint`, this.getHeaders());
  }
}
```

---

## 🎨 Estilos CSS

### Sistema de Diseño

#### Color Palette

```css
--primary: #007AFF      /* Azul - Acciones principales */
--success: #28a745      /* Verde - Confirmaciones */
--warning: #ffc107      /* Amarillo - Advertencias */
--danger: #dc3545       /* Rojo - Errores/Alergenos */
--light: #f8f9fa        /* Gris claro - Fondos */
--dark: #212529         /* Gris oscuro - Texto */
```

#### Tipografía

```css
/* Sizes */
--font-xs:  12px
--font-sm:  14px
--font-md:  16px
--font-lg:  18px
--font-xl:  24px

/* Line heights */
--line-height: 1.5
--heading-line-height: 1.2
```

#### Espaciado

```css
/* Base: 8px */
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px
```

### Clases Globales

En `styles.css` encontrarás:

- `.header` - Headers consistentes
- `.tabs` - Navegación por pestañas
- `.modal-overlay` - Modal backgrounds
- `.btn-*` - Button styles (primary, secondary, danger)
- `.form-group` - Form input groups
- `.message` - Alert/notification messages

### Componentes Específicos

#### Modal Pattern

```html
<div class="modal-overlay" (click)="cerrar()">
  <div class="modal-content" (click)="$event.stopPropagation()">
    <h2>Title</h2>
    <!-- Content -->
    <button class="btn-primary">Action</button>
  </div>
</div>
```

#### Card Pattern

```html
<div class="card">
  <div class="card-header">
    <h3>{{ title }}</h3>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
</div>
```

---

## 📝 Convenciones de Código

### Naming Conventions

#### TypeScript

```typescript
// Classes: PascalCase
export class UserService { }

// Functions: camelCase
function obtenerDatos() { }

// Constants: UPPER_SNAKE_CASE
const API_URL = 'http://...';

// Private properties: _camelCase
private _cache: any;

// Booleans: is/has/show/should prefix
isLoading: boolean;
hasError: boolean;
showModal: boolean;
shouldUpdate: boolean;
```

#### HTML Templates

```html
<!-- Property binding -->
[property]="value"

<!-- Event binding -->
(click)="handleClick()"

<!-- Two-way binding -->
[(ngModel)]="property"

<!-- Structural directives -->
@if (condition) { ... }
@for (item of array; track item.id) { ... }
```

#### CSS

```css
/* Block-Element-Modifier -->
.component { }
.component__element { }
.component--modifier { }

/* Example -->
.card { }
.card__header { }
.card--highlighted { }
```

### Import Order

```typescript
// 1. Angular
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// 2. Third-party
import { SomeLib } from 'some-lib';

// 3. Local services
import { MyService } from '../../services/my.service';

// 4. Local components
import { ChildComponent } from '../child/child.component';
```

---

## 🔄 Patrones de Desarrollo

### Componente Reactivo (Patrón Recomendado)

```typescript
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (loading) {
      <div class="spinner">Cargando...</div>
    }
    @if (error) {
      <div class="message error">{{ error }}</div>
    }
    @for (user of users; track user.id) {
      <div class="user-item">{{ user.name }}</div>
    }
  `
})
export class UserListComponent implements OnInit {
  users: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error cargando usuarios';
        this.loading = false;
      }
    });
  }
}
```

### Manejo de Errores

```typescript
// En servicios
httpCall(): Observable<Data> {
  return this.http.get<Data>(url).pipe(
    catchError(error => {
      console.error('API error:', error);
      return throwError(() => new Error('Request failed'));
    })
  );
}

// En componentes
this.service.httpCall().subscribe({
  next: (data) => { /* success */ },
  error: (err) => { 
    this.error = 'Algo salió mal';
    this.showErrorMessage();
  }
});
```

### Loading States

```typescript
// Patrón consistente para carga
@Component({
  template: `
    @if (loading) {
      <div class="spinner">Cargando...</div>
    } @else if (error) {
      <div class="message error">{{ error }}</div>
    } @else {
      <!-- Content -->
    }
  `
})
export class MyComponent {
  loading = false;
  error: string | null = null;
  data: any = null;
}
```

---

## 🔌 API Backend

### Estructura de Endpoints

Todos los endpoints siguen este patrón:

```
GET    /api/resource              # Lista todos
GET    /api/resource/:id          # Obtiene uno
POST   /api/resource              # Crea uno
PUT    /api/resource/:id          # Actualiza
DELETE /api/resource/:id          # Elimina
```

### Respuestas Estándar

#### Success (200)
```json
{
  "data": { /* resource */ },
  "message": "Success message"
}
```

#### Errores (4xx, 5xx)
```json
{
  "error": "Error description",
  "status": 400
}
```

### Autenticación

Todos los endpoints protegidos requieren:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 💾 Base de Datos

### Modelos Principales

#### Usuario
```python
- id (PK)
- email (UNIQUE)
- password_hash
- nombre_completo
- limites_calorias
- limites_proteinas
- limites_grasas
- limites_azucares
```

#### Alimento
```python
- id (PK)
- usuario_id (FK)
- nombre
- descripcion
- calorias
- proteinas
- grasas
- azucares
- favorito (bool)
```

#### Ingrediente
```python
- id (PK)
- nombre
- categoria
- es_aditivo
- notas
- alergenos_categorias (JSON)
- verificado (bool)
```

#### ComidaDiaria
```python
- id (PK)
- usuario_id (FK)
- fecha
- raciones (JSON con referencias)
- totales_calorias
- totales_proteinas
```

### Relaciones

```
Usuario
  ├─ Alimentos (1:N)
  ├─ Raciones (1:N)
  └─ ComidaDiarias (1:N)

Alimento
  ├─ Ingredientes (N:N vía JSON)
  └─ Raciones (N:N vía JSON)
```

---

## ✅ Checklist para Nuevas Features

- [ ] Crear componente Angular standalone
- [ ] Crear/actualizar servicio HTTP
- [ ] Implementar tipos TypeScript
- [ ] Agregar manejo de errores
- [ ] Hacer loading states
- [ ] Crear endpoint backend si es necesario
- [ ] Validar en el modelo SQLAlchemy
- [ ] Agregar tests (si aplica)
- [ ] Documentar en este archivo
- [ ] Revisar estilos CSS (paleta, espaciado)

---

## 📚 Recursos Útiles

- [Angular Documentation](https://angular.io/docs)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/)

---

**Última actualización:** Junio 2026
**Versión:** 1.0
