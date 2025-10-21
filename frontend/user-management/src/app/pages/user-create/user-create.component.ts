import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-user-create',
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.css']
})
export class UserCreateComponent {
  username = '';
  email = '';
  password = '';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<UserCreateComponent>
  ) {}

  createUser(): void {
    this.api.createUser({ username: this.username, email: this.email, password: this.password }).subscribe({
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

