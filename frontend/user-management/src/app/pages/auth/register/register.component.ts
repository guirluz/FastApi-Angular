import { Component } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  message = '';

  constructor(private api: ApiService, private router: Router) {}

  register(): void {
    this.api.register({ username: this.username, email: this.email, password: this.password }).subscribe({
      next: () => {
        this.message = '✅ Usuario registrado correctamente';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: () => {
        this.message = '❌ Error al registrar usuario';
      }
    });
  }
}
