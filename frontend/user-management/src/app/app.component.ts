import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(
    private auth: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Conectar WebSocket de notificaciones al iniciar la app
    this.notificationService.connect();
    
    // Cargar tema guardado al iniciar
    this.loadSavedTheme();
  }

  logout(): void {
    this.auth.logout();
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  editProfile(): void {
    // Redirigir a la página de perfil
    this.router.navigate(['/profile']);
  }

  goToHome(): void {
    // Redirigir a la lista de usuarios (página principal)
    this.router.navigate(['/users']);
  }

  changeTheme(theme: 'light' | 'dark' | 'auto'): void {
    console.log('🎨 Cambiando tema a:', theme);
    
    // Guardar preferencia en localStorage
    localStorage.setItem('theme', theme);
    
    // Aplicar el tema
    this.applyTheme(theme);
  }

  private loadSavedTheme(): void {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'auto';
    if (savedTheme) {
      this.applyTheme(savedTheme);
    } else {
      // Por defecto, tema claro
      this.applyTheme('light');
    }
  }

  private applyTheme(theme: 'light' | 'dark' | 'auto'): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    
    if (theme === 'light') {
      body.classList.add('light-theme');
    } else if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      // Modo automático: detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');
    }
  }
}