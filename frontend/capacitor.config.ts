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
    contentInset: 'automatic',
  },
};

export default config;
