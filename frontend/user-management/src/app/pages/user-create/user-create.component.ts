import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-user-create',
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.css']
})
export class UserCreateComponent implements OnInit {
  username = '';
  email = '';
  password = '';
  roles: any[] = [];              // 👈 Lista de roles
  selectedRoleId: number | null = null; // 👈 Rol seleccionado

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<UserCreateComponent>
  ) {}

  ngOnInit(): void {
    // Cargar roles desde el backend
    this.api.getRoles().subscribe({
      next: (res) => {
        // Ajusta según la estructura de tu backend
        this.roles = res.data || res;
      },
      error: (err) => {
        console.error('❌ Error al cargar roles', err);
      }
    });
  }

  createUser(): void {
    const userData = {
      username: this.username,
      email: this.email,
      password: this.password,
      role_id: this.selectedRoleId   // 👈 Se envía el role_id
    };

    this.api.createUser(userData).subscribe({
      next: () => {
        this.dialogRef.close('success');
      },
      error: (err: any) => {
        console.error('❌ Error al crear usuario', err);
        // Aquí puedes agregar lógica para mostrar un mensaje de error al usuario
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}


