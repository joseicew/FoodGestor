# 🚀 Guía de Contribución - FoodGestor

## 📖 Tabla de Contenidos

1. [Setup Inicial](#setup-inicial)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Desarrollo Local](#desarrollo-local)
4. [Crear una Feature](#crear-una-feature)
5. [Testing](#testing)
6. [Git Workflow](#git-workflow)

---

## 🔧 Setup Inicial

### Requisitos Previos

- **Node.js** 18+ (para Angular)
- **Python** 3.8+ (para Flask)
- **Git**
- Navegador web moderno

### Backend Setup

```bash
# 1. Entra a la carpeta backend
cd backend

# 2. Crea un virtual environment (recomendado)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Instala dependencias
pip install -r requirements.txt

# 4. Ejecuta el servidor
python main.py
# El servidor estará en http://localhost:5000
```

### Frontend Setup

```bash
# 1. Entra a la carpeta frontend
cd frontend

# 2. Instala dependencias
npm install

# 3. Compila la app
npm run build

# 4. Sirve la app compilada (necesitas http-server)
npm install -g http-server
cd dist/frontend/browser
http-server -p 4200 -a 192.168.1.17

# La app estará en http://192.168.1.17:4200
```

---

## 📁 Estructura del Proyecto

### Backend

```
backend/
├── app/
│   ├── models/
│   │   ├── usuario.py          # User model
│   │   ├── ingrediente.py      # Ingredient model
│   │   ├── alimento.py         # Food item model
│   │   ├── racion.py           # Portion model
│   │   └── comida_diaria.py    # Daily meal tracking
│   │
│   ├── routes/
│   │   ├── auth.py             # Auth endpoints
│   │   ├── alimentos.py        # Food endpoints
│   │   ├── ingredientes.py     # Ingredient endpoints
│   │   ├── raciones.py         # Portion endpoints
│   │   ├── calendario.py       # Calendar endpoints
│   │   └── ocr.py              # OCR endpoints
│   │
│   ├── __init__.py             # App factory
│   └── config.py               # Configuration
│
├── main.py                      # Entry point
├── requirements.txt             # Dependencies
└── .env                        # Environment variables (NOT in git)
```

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── alimentos/      # Food management
│   │   │   ├── raciones/       # Portion management
│   │   │   ├── calendario/     # Calendar view
│   │   │   ├── perfil/         # User profile
│   │   │   ├── login/          # Login page
│   │   │   └── registro/       # Registration page
│   │   │
│   │   ├── services/
│   │   │   ├── alimentos.ts    # Food service
│   │   │   ├── auth.ts         # Auth service
│   │   │   ├── raciones.ts     # Portion service
│   │   │   └── calendario.ts   # Calendar service
│   │   │
│   │   ├── guards/
│   │   │   └── auth.guard.ts   # Route protection
│   │   │
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts  # JWT injection
│   │   │
│   │   ├── app.ts              # Main component
│   │   ├── app.routes.ts       # Routing
│   │   ├── app.config.ts       # App configuration
│   │   └── styles.css          # Global styles
│   │
│   ├── index.html
│   └── main.ts
│
├── dist/
│   └── frontend/
│       └── browser/            # Compiled app
│
├── angular.json
├── package.json
└── tsconfig.json
```

---

## 💻 Desarrollo Local

### Ejecutar Backend y Frontend Simultáneamente

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate
python main.py
# Esperando en http://localhost:5000
```

**Terminal 2 (Frontend - Build Watch):**
```bash
cd frontend
npm run build -- --watch --configuration development
# Compilando cambios automáticamente
```

**Terminal 3 (Frontend - Servidor HTTP):**
```bash
cd frontend/dist/frontend/browser
http-server -p 4200 -a 192.168.1.17
# App disponible en http://192.168.1.17:4200
```

### Acceder desde Móvil

1. Asegúrate que tu móvil está en la **misma red WiFi**
2. Abre el navegador
3. Navega a: `http://192.168.1.17:4200`

---

## ✨ Crear una Feature

### Paso 1: Planificar

- ¿Qué hace la feature?
- ¿Qué endpoints necesita?
- ¿Qué cambios en la BD?
- ¿Cómo se ve?

### Paso 2: Rama de Git

```bash
git checkout -b feature/nombre-feature
```

### Paso 3: Backend (si es necesario)

1. **Crear/actualizar modelo** en `app/models/`
2. **Crear endpoints** en `app/routes/`
3. **Testar con Postman/curl**

Ejemplo:
```python
# app/routes/ejemplo.py
@ejemplo_bp.route('/datos', methods=['GET'])
def obtener_datos():
    datos = Ejemplo.query.all()
    return jsonify([d.to_dict() for d in datos])
```

### Paso 4: Frontend (TypeScript + HTML + CSS)

1. **Crear componente** en `app/components/`
```bash
ng generate component components/mi-componente
```

2. **Crear servicio** en `app/services/`
3. **Crear rutas** en `app.routes.ts` si aplica
4. **Crear estilos** en `component.css`

Ejemplo:
```typescript
@Component({
  selector: 'app-mi-componente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `<h1>Mi Feature</h1>`
})
export class MiComponenteComponent { }
```

### Paso 5: Testing

- ✅ Abre http://192.168.1.17:4200
- ✅ Prueba la feature en navegador
- ✅ Abre DevTools (F12) y revisa la consola
- ✅ Revisa Network tab para requests

### Paso 6: Commit

```bash
git add .
git commit -m "feature: Agregar nueva funcionalidad

- Descripción de cambios
- Qué endpoints se agregaron
- Qué componentes se modificaron"
```

### Paso 7: Push y Pull Request

```bash
git push origin feature/nombre-feature
# Luego crea PR en GitHub
```

---

## 🧪 Testing

### Backend Testing

```bash
cd backend
python -m pytest tests/
```

### Frontend Testing

```bash
cd frontend
npm test
```

### Manual Testing Checklist

- [ ] Feature funciona en el navegador
- [ ] No hay errores en la consola
- [ ] API requests se ven bien en Network tab
- [ ] Tokens JWT están siendo enviados
- [ ] Respuestas JSON son correctas
- [ ] UI responde a cambios de estado
- [ ] Errores se manejan correctamente

---

## 📝 Git Workflow

### Convención de Commits

```
feat:     Nueva funcionalidad
fix:      Corregir bug
docs:     Documentación
style:    Cambios de formato (sin cambios lógicos)
refactor: Refactorización de código
test:     Agregar/modificar tests
chore:    Mantenimiento, actualizar deps, etc.
```

Ejemplos:
```
feat: Agregar validación de alergenos
fix: Resolver problema de carga de alimentos
docs: Actualizar guía de contribución
refactor: Simplificar lógica de autenticación
```

### Branch Naming

```
feature/nombre-descriptivo      # Nuevas features
bugfix/nombre-del-bug           # Fixes
docs/tema-documentacion         # Docs
refactor/area-del-codigo        # Refactoring
```

### Antes de hacer Push

```bash
# 1. Actualizar main local
git checkout main
git pull origin main

# 2. Rebase tu rama (optional pero recomendado)
git checkout feature/tu-feature
git rebase main

# 3. Resolver conflictos si hay

# 4. Push
git push origin feature/tu-feature
```

---

## 🚨 Troubleshooting

### Backend no inicia
```
Error: Address already in use
→ El puerto 5000 está en uso. Cambia el puerto en main.py
```

### Frontend no se compila
```
Error: Node modules corrupted
→ rm -rf node_modules && npm install
```

### CORS errors
```
Access-Control-Allow-Origin error
→ Revisa que el backend está habilitando CORS
→ Revisa la URL base en los servicios Angular
```

### App no carga en móvil
```
No puedo acceder a http://192.168.1.17:4200
→ Asegúrate que estás en la misma red WiFi
→ Revisa que http-server está corriendo
→ Prueba con http://192.168.1.17:4200/index.html
```

---

## 📚 Recursos

- [Angular Best Practices](https://angular.io/guide/styleguide)
- [Flask Patterns](https://flask.palletsprojects.com/patterns/)
- [Git Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow)

---

**¿Tienes dudas?** Revisa el archivo `DESIGN_GUIDELINES.md` para patrones y convenciones.
