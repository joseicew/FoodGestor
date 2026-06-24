import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// En producción (el IPA) silenciamos los logs de depuración para que la app
// vaya más fluida. En desarrollo se mantienen para depurar. console.error se
// conserva siempre para no perder errores reales.
if (environment.production) {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js', { scope: '/' })
    .then((reg) => {
      console.log('✅ Service Worker registrado:', reg);
    })
    .catch((err) => {
      console.error('❌ Error registrando Service Worker:', err);
    });
}
