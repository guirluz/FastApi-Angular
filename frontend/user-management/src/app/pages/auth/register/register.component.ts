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
  roles: Role[] = [];
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
      role_id: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    console.log('🔄 Iniciando carga de roles...');
    
    this.authService.getRoles().subscribe({
      next: (response) => {
        console.log('📦 Respuesta completa:', response);
        console.log('📦 response.status:', response.status);
        console.log('📦 response.data:', response.data);
        
        // Verificar que la respuesta tenga status 200 y data
        if (response.status === 200 && response.data) {
          this.roles = response.data;
          console.log('✅ Roles asignados:', this.roles);
          console.log('✅ Cantidad de roles:', this.roles.length);
        } else {
          console.warn('⚠️ Respuesta inesperada:', response);
          this.message = 'Error al procesar roles';
          this.isError = true;
        }
        
        this.isLoadingRoles = false;
        console.log('✅ isLoadingRoles:', this.isLoadingRoles);
      },
      error: (error) => {
        console.error('❌ Error al cargar roles:', error);
        console.error('❌ Error completo:', JSON.stringify(error, null, 2));
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
        role_id: parseInt(this.registerForm.value.role_id)
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
          // Extraer mensaje de error del backend
          this.message = error.error?.message || error.error?.detail || 'Error al registrar usuario';
          this.isError = true;
        }
      });
    } else {
      this.message = 'Por favor completa todos los campos correctamente';
      this.isError = true;
    }
  }
}


