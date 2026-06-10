# 🎨 Design System - FoodGestor

## Visión General

FoodGestor es una aplicación de gestión nutricional que debe ser **intuitiva, moderna y accesible**. Este documento define las reglas de diseño para mantener coherencia visual y experiencia de usuario.

---

## 1. Inspiración en Modelos UI Modernos

### 🔵 Modelos Adoptados:

#### **Material Design 3 (Google)**
- Superficies redondeadas (border-radius: 12-20px)
- Sombras sutiles y dinámicas
- Tipografía escalada (grandes títulos, textos legibles)
- Espaciado consistente (8px grid)
- Colores vibrantes pero accesibles

#### **Apple Human Interface Guidelines**
- Minimalismo y claridad
- Grandes áreas de espacio blanco
- Interacciones fluidas y naturales
- Seguridad cognitiva (cambios reversibles)
- Accesibilidad como prioridad

#### **Glassmorphism (Tendencia 2024-2025)**
- Fondos semi-transparentes (backdrop-filter: blur)
- Bordes sutiles con rgba
- Profundidad visual sin cargas
- Moderna y premium

---

## 2. Paleta de Colores

### Colores Principales:

```
Primario:     #007AFF (Azul Apple)
Primario Alt: #FF6B35 (Naranja Vivo)
Neutro Gold:  #FFA500 (Dorado/Comida)

Superficies:
- Fondo:      #FFFFFF (Claro) / #0A0E27 (Oscuro)
- Tarjetas:   #F2F2F7 (Claro) / #1C1C1E (Oscuro)
- Bordes:     #E5E5EA (Claro) / #3A3A3C (Oscuro)

Estados:
- Éxito:      #34C759 (Verde)
- Advertencia: #FF9500 (Naranja)
- Error:      #FF3B30 (Rojo)
- Info:       #007AFF (Azul)
```

### Tema Oscuro:
- Preferencia por temas claros por defecto
- Soportar tema oscuro en iOS 13+
- Mantener suficiente contraste (WCAG AA)

---

## 3. Tipografía

### Fuente Principal: **Inter** o **SF Pro Display** (Apple)

```
Tamaños:
- H1 Títulos:      32-40px, Bold (700)
- H2 Subtítulos:   24-28px, Semibold (600)
- H3 Secciones:    20-24px, Semibold (600)
- Body (primario):  16px, Regular (400)
- Body (secundario):14px, Regular (400)
- Caption:         12px, Regular (400)
- Overline:        11px, Uppercase, Semibold (600)

Line Height:
- Títulos:  1.2
- Body:     1.5
- Captions: 1.4
```

### Reglas:
- ✅ Máximo 3 pesos de fuente por pantalla
- ✅ Máximo 2 tamaños de fuente para body text
- ❌ No usar más de 4 niveles de jerarquía tipográfica

---

## 4. Espaciado (8px Grid System)

```
Espacio Base: 8px

Escala:
- xs:  4px   (Separación mínima entre elementos)
- sm:  8px   (Padding interior botones, margin entre elementos)
- md:  16px  (Padding principal, spacing de secciones)
- lg:  24px  (Espacios grandes, separación de bloques)
- xl:  32px  (Espacios muy grandes, screen padding)
- 2xl: 48px  (Separación entre pantallas)
```

### Aplicación:
```css
/* Tarjeta/Card */
.card {
  padding: 16px;        /* md */
  margin-bottom: 16px;  /* md */
  border-radius: 12px;  /* md */
}

/* Botón */
.button {
  padding: 12px 16px;   /* sm/md vertical/horizontal */
  margin: 8px;          /* sm */
  border-radius: 8px;   /* sm */
}

/* Screen */
.screen {
  padding: 24px;        /* lg */
  gap: 16px;            /* md */
}
```

---

## 5. Componentes Base

### ✅ Botones

```css
/* Primary Button */
.btn-primary {
  background: #007AFF;
  color: white;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: #0051D5;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 122, 255, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Secondary Button */
.btn-secondary {
  background: #F2F2F7;
  color: #007AFF;
  border: 2px solid #007AFF;
  padding: 10px 22px;
}

/* Tertiary Button */
.btn-tertiary {
  background: transparent;
  color: #007AFF;
  border: none;
  text-decoration: underline;
}
```

### ✅ Cards/Tarjetas

```css
.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

/* Glass Effect */
.card-glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### ✅ Inputs

```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #E5E5EA;
  border-radius: 10px;
  font-size: 16px;
  font-family: inherit;
  transition: all 0.2s ease;
}

.input:focus {
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  outline: none;
}

.input::placeholder {
  color: #999999;
}
```

### ✅ Badges/Etiquetas

```css
.badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #F2F2F7;
  color: #333;
}

.badge-primary {
  background: #007AFF;
  color: white;
}

.badge-success {
  background: #D1F4D1;
  color: #34C759;
}
```

---

## 6. Patrones de Interacción

### Transiciones y Animaciones

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* Aplicación */
.modal {
  animation: slideUp 0.3s ease-out;
}

/* Duración estándar */
transition: all 0.2s ease;  /* Interacciones rápidas */
transition: all 0.3s ease;  /* Cambios visuales */
transition: all 0.5s ease;  /* Animaciones notables */
```

### Estados de Controles

```
Normal:     Color primario, sin sombra
Hover:      Color más oscuro, sombra suave
Focus:      Borde/outline visible, shadow ring
Active:     Transformación (scale/translate)
Disabled:   Opacidad 50%, cursor no-allowed
Loading:    Spinner, disabled state
```

---

## 7. Estructura de Pantallas

### Layout Estándar

```
┌─────────────────────────────┐
│  Header (Fijo)              │ 56-64px
├─────────────────────────────┤
│                             │
│  Content Area               │
│  (Scrollable)               │
│                             │
├─────────────────────────────┤
│  Bottom Navigation (Fijo)    │ 56px (Mobile)
└─────────────────────────────┘
```

### Márgenes y Padding

```
- Screen horizontal padding: 16-24px
- Card padding: 16px
- Section spacing: 24px
- Element gap: 12-16px
```

---

## 8. Accesibilidad

### Colores
- ✅ Contraste mínimo 4.5:1 para texto
- ✅ No usar color solo para comunicar información
- ✅ Soportar colorblindness (no solo rojo/verde)

### Interacción
- ✅ Touch targets mínimo 48x48px
- ✅ Focus visible en todos los elementos interactivos
- ✅ Tamaño de fuente mínimo 16px en inputs

### Movimiento
- ✅ Respetar `prefers-reduced-motion`
- ✅ Sin animaciones que parpadeen >3 veces/segundo
- ✅ Sin auto-play de videos/sonido

---

## 9. Mejoras para FoodGestor

### Pantalla de Login

```html
<!-- Glass effect modern -->
<div class="card-glass">
  <h1>FoodGestor</h1>
  <p class="text-secondary">Gestiona tu nutrición</p>
  
  <input placeholder="Email" />
  <input type="password" placeholder="Contraseña" />
  
  <button class="btn-primary">Entrar</button>
  <button class="btn-tertiary">¿Olvidaste tu contraseña?</button>
</div>
```

### Tarjeta de Alimento

```html
<div class="card">
  <div class="food-header">
    <h3>Manzana Roja</h3>
    <span class="badge badge-success">Verificado</span>
  </div>
  
  <div class="nutrients-grid">
    <div class="nutrient">
      <span class="label">Calorías</span>
      <span class="value">95 kcal</span>
    </div>
    <div class="nutrient">
      <span class="label">Proteínas</span>
      <span class="value">0.5g</span>
    </div>
  </div>
  
  <div class="actions">
    <button class="btn-secondary">Agregar</button>
    <button class="btn-tertiary">Ver detalles</button>
  </div>
</div>
```

### Bottom Navigation (Mobile)

```html
<nav class="bottom-nav">
  <a href="/perfil" class="nav-item active">
    <span class="icon">👤</span>
    <span class="label">Perfil</span>
  </a>
  <a href="/alimentos" class="nav-item">
    <span class="icon">🥗</span>
    <span class="label">Alimentos</span>
  </a>
  <a href="/raciones" class="nav-item">
    <span class="icon">🍽️</span>
    <span class="label">Raciones</span>
  </a>
  <a href="/calendario" class="nav-item">
    <span class="icon">📅</span>
    <span class="label">Calendario</span>
  </a>
</nav>
```

---

## 10. Evolución del Diseño

### Fase 1 (Actual): Modernización Base
- ✅ Adoptar Material Design 3
- ✅ Implementar colores actualizados
- ✅ Glassmorphism en overlays
- ✅ Transiciones suaves

### Fase 2: Mejoras Visuales
- 📋 Animaciones micro-interacciones
- 📋 Temas personalizables
- 📋 Dark mode completo
- 📋 Iconografía personalizada

### Fase 3: Experiencia Avanzada
- 📋 Gestos táctiles avanzados
- 📋 Haptic feedback
- 📋 Widgets del sistema (iOS/Android)
- 📋 Integración con salud del dispositivo

---

## 11. Checklist de Implementación

Cuando modifiques diseño, verifica:

- ✅ Colores: ¿Usa paleta definida?
- ✅ Espaciado: ¿Usa múltiplos de 8px?
- ✅ Tipografía: ¿Respeta jerarquía?
- ✅ Componentes: ¿Reutiliza existentes?
- ✅ Transiciones: ¿Fluidas y apropiadas?
- ✅ Accesibilidad: ¿Contraste y focus?
- ✅ Mobile-first: ¿Funciona en móvil?
- ✅ Consistencia: ¿Matches con otras pantallas?

---

## Referencias

- Material Design 3: https://m3.material.io
- Apple HIG: https://developer.apple.com/design/human-interface-guidelines
- Glassmorphism: https://hype4.academy/articles/design/glassmorphism-in-user-interfaces
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/

---

**Última actualización:** Junio 2026
**Versión:** 1.0
**Responsable:** FoodGestor Design Team
