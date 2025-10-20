import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.css']
})
export class UserEditComponent {
  id!: number;
  username = '';
  email = '';
  password = '';
  message = '';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<UserEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Precargar datos del usuario recibido
    if (data) {
      this.id = data.id;
      this.username = data.username;
      this.email = data.email;
    }
  }

  updateUser(): void {
    const payload: any = {
      username: this.username,
      email: this.email
    };

    if (this.password.trim() !== '') {
      payload.password = this.password;
    }

    this.api.updateUser(this.id, payload).subscribe({
      next: () => {
        this.message = '✅ Usuario actualizado';
        setTimeout(() => this.dialogRef.close('success'), 1000);
      },
      error: (err) => {
        console.error('❌ Error al actualizar usuario', err);
        this.message = '❌ Error al actualizar usuario';
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}



