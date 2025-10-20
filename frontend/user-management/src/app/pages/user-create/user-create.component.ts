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
  message = '';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<UserCreateComponent>
  ) {}

  createUser(): void {
    this.api.register({ username: this.username, email: this.email, password: this.password }).subscribe({
      next: () => {
        this.message = '✅ Usuario creado correctamente';
        setTimeout(() => this.dialogRef.close('success'), 1000);
      },
      error: () => {
        this.message = '❌ Error al crear usuario';
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

