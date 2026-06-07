import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

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
