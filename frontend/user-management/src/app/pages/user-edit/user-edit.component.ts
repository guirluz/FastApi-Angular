import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.css']
})
export class UserEditComponent {
  user: { id: number; username: string; email: string } = { id: 0, username: '', email: '' };
  newPassword = '';
  message = '';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<UserEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Precargar datos del usuario recibido
    if (data) {
      this.user = { ...data };
    }
  }

  updateUser(): void {
    const payload: any = {
      username: this.user.username,
      email: this.user.email
    };

    if (this.newPassword.trim() !== '') {
      payload.password = this.newPassword;
    }

    this.api.updateUser(this.user.id, payload).subscribe({
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

  cancel(): void {
    this.dialogRef.close();
  }
}

