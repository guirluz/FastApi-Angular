import { Component } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  login(): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('Intentando login con email:', this.email);

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        console.log('✅ Login exitoso:', response);
        this.isLoading = false;
        
        // Obtener el rol guardado
        const role = this.authService.getRole();
        console.log('Rol del usuario:', role);
        
        // Normalizar el rol y redirigir correctamente
        const normalizedRole = role?.toLowerCase().trim() || '';
        
        if (normalizedRole.includes('administrador') || normalizedRole.includes('admin')) {
          console.log('Redirigiendo a /users (admin)');
          this.router.navigate(['/users']);
        } else if (normalizedRole.includes('cliente') || normalizedRole.includes('client')) {
          console.log('Redirigiendo a /rentals (client)');
          this.router.navigate(['/rentals']);
        } else {
          console.warn('Rol no reconocido:', role, '- Redirigiendo a /users por defecto');
          this.router.navigate(['/users']);
        }
      },
      error: (error) => {
        console.error('❌ Error en login:', error);
        this.isLoading = false;
        
        if (error.error?.detail) {
          this.errorMessage = error.error.detail;
        } else if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Credenciales inválidas';
        }
      }
    });
  }
}

