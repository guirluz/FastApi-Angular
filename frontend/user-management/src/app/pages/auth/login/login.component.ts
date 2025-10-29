import { Component } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = ''; // 👈 Usar email como en el backend
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

    // 👇 Enviar email en lugar de username
    this.authService.login({ email: this.email, password: this.password } as any).subscribe({
      next: (response) => {
        console.log('✅ Login exitoso:', response);
        this.isLoading = false;
        
        // AuthService ya guardó el token, role y username en localStorage
        const role = this.authService.getRole();
        console.log('Rol del usuario:', role);
        
        // Redirigir según el rol
        if (role === 'admin') {
          console.log('Redirigiendo a /users (admin)');
          this.router.navigate(['/users']);
        } else {
          console.log('Redirigiendo a /products (client)');
          this.router.navigate(['/products']);
        }
      },
      error: (error) => {
        console.error('❌ Error en login:', error);
        this.isLoading = false;
        
        // Extraer mensaje de error específico
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
