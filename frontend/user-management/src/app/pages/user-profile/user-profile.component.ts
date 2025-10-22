import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  user: any = null;
  editUser: any = {
    username: '',
    email: '',
    password: ''
  };
  isEditMode = false;
  isSaving = false;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    // Intentar obtener el usuario del localStorage primero
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      console.log('✅ Usuario cargado desde localStorage:', this.user);
    }
    
    // Siempre actualizar desde la API para tener datos frescos
    this.api.getProfile().subscribe({
      next: (response: any) => {
        this.user = response.data || response;
        localStorage.setItem('user', JSON.stringify(this.user));
        console.log('✅ Perfil actualizado desde API:', this.user);
      },
      error: (err: any) => {
        console.error('⚠️ Error cargando perfil desde API:', err);
        // Si falla la API pero tenemos datos en localStorage, los usamos
        if (!this.user) {
          this.snackBar.open('❌ Error al cargar el perfil', 'Cerrar', { 
            duration: 3000 
          });
        }
      }
    });
  }

  enableEditMode(): void {
    this.isEditMode = true;
    // Copiar datos actuales al objeto de edición
    this.editUser = {
      username: this.user?.username || '',
      email: this.user?.email || '',
      password: '' // La contraseña se deja vacía
    };
  }

  cancelEdit(): void {
    this.isEditMode = false;
    this.editUser = {
      username: '',
      email: '',
      password: ''
    };
  }

  saveProfile(): void {
    if (!this.editUser.username || !this.editUser.email) {
      this.snackBar.open('⚠️ El usuario y email son obligatorios', 'Cerrar', { 
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.isSaving = true;

    // Preparar datos para enviar (solo si hay cambios)
    const updateData: any = {
      username: this.editUser.username,
      email: this.editUser.email
    };

    // Solo incluir password si se ingresó uno nuevo
    if (this.editUser.password && this.editUser.password.trim() !== '') {
      updateData.password = this.editUser.password;
    }

    // Llamar a la API para actualizar
    this.api.updateUser(this.user.id, updateData).subscribe({
      next: (response: any) => {
        console.log('✅ Perfil actualizado:', response);
        
        // Actualizar el usuario local
        this.user = { ...this.user, ...updateData };
        delete this.user.password; // No guardar la contraseña en localStorage
        localStorage.setItem('user', JSON.stringify(this.user));
        
        // Mostrar mensaje de éxito
        this.snackBar.open('✅ Perfil editado exitosamente', 'Cerrar', { 
          duration: 4000,
          panelClass: ['snackbar-success']
        });
        
        this.isSaving = false;
        this.isEditMode = false;
        this.editUser = { username: '', email: '', password: '' };
      },
      error: (err: any) => {
        console.error('❌ Error actualizando perfil:', err);
        const errorMsg = err.error?.message || 'Error al actualizar el perfil';
        
        this.snackBar.open(`❌ ${errorMsg}`, 'Cerrar', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
        
        this.isSaving = false;
      }
    });
  }

  getUserInitials(): string {
    if (!this.user?.username) return '?';
    const name = this.user.username.toUpperCase();
    return name.length >= 2 ? name.substring(0, 2) : name;
  }
}