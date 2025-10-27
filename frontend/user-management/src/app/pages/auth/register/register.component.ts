import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

interface Role {
  id: number;
  nombre: string;
  descripcion: string;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  message = '';
  isError = false;
  roles: Role[] = [];  // 👈 AGREGADO: Lista de roles desde BD
  isLoadingRoles = true;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.formBuilder.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role_id: ['', Validators.required]  // 👈 CAMBIO: Ahora es role_id
    });
  }

  ngOnInit(): void {
    // 👇 AGREGADO: Cargar roles al iniciar
    this.loadRoles();
  }

  loadRoles(): void {
    this.authService.getRoles().subscribe({
      next: (response) => {
        if (response.status === 200 && response.data) {
          this.roles = response.data;
          console.log('✅ Roles cargados:', this.roles);
        }
        this.isLoadingRoles = false;
      },
      error: (error) => {
        console.error('❌ Error al cargar roles:', error);
        this.message = 'Error al cargar roles disponibles';
        this.isError = true;
        this.isLoadingRoles = false;
      }
    });
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      const userData = {
        username: this.registerForm.value.username,
        email: this.registerForm.value.email,
        password: this.registerForm.value.password,
        role_id: parseInt(this.registerForm.value.role_id)  // 👈 Asegurar que sea int
      };

      console.log('📤 Datos enviados al backend:', userData);

      this.authService.register(userData).subscribe({
        next: (response) => {
          console.log('✅ Registration successful', response);
          this.message = 'Usuario registrado correctamente';
          this.isError = false;
          setTimeout(() => this.router.navigate(['/login']), 1500);
        },
        error: (error) => {
          console.error('❌ Registration failed', error);
          // 👇 MEJORADO: Mostrar mensaje del servidor
          this.message = error.error?.message || 'Error al registrar usuario';
          this.isError = true;
        }
      });
    } else {
      this.message = 'Por favor completa todos los campos correctamente';
      this.isError = true;
    }
  }
}

