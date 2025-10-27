import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

// Añadir este código para manejar errores de carga
window.addEventListener('error', function(e) {
  console.error('Error de carga:', e.error);
});
