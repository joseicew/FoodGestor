import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joza.foodgestor',
  appName: 'FoodGestor',
  webDir: 'dist/frontend/browser',
  server: {
    // En desarrollo local: descomenta y pon tu IP para hot-reload
    // url: 'http://192.168.1.17:4200',
    // cleartext: true,
  },
  ios: {
    // 'never': el webview ocupa la pantalla completa, borde a borde. Con
    // 'automatic', iOS encogía el contenido dejando una franja inferior
    // muerta (no reaccionaba al toque) y env(safe-area-inset-bottom)
    // devolvía 0, rompiendo los ajustes CSS del safe-area. Los huecos del
    // notch/home indicator los gestiona el CSS via viewport-fit=cover + env().
    contentInset: 'never',
  },
};

export default config;
