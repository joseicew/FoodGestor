import { defineConfig } from 'vite';
import angular from '@angular/build';

export default defineConfig(
  angular({
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          logLevel: 'debug'
        }
      }
    }
  })
);
