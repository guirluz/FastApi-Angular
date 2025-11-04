import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

import { UserCreateComponent } from '../user-create/user-create.component';
import { UserEditComponent } from '../user-edit/user-edit.component';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'username', 'email', 'actions'];
  dataSource = new MatTableDataSource<any>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private api: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.api.getUsers().subscribe({
      next: (res) => {
        this.dataSource.data = res.data || [];
        this.dataSource.paginator = this.paginator;
      },
      error: (err) => {
        console.error('Error cargando usuarios', err);
      }
    });
  }

  deleteUser(userId: number): void {
    if (confirm('¿Seguro que deseas eliminar este usuario?')) {
      this.api.deleteUser(userId).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: () => {
          console.error('Error al eliminar usuario');
        }
      });
    }
  }

  openCreateUserModal(): void {
    const dialogRef = this.dialog.open(UserCreateComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadUsers();
      }
    });
  }

  openEditUserModal(user: any): void {
    const dialogRef = this.dialog.open(UserEditComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: user
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadUsers();
      }
    });
  }

  onImportCompleted(): void {
    this.loadUsers();
  }

  downloadPDF(): void {
    this.api.getUsersPDF().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_report_${new Date().toISOString().slice(0,19)}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar PDF', err);
        alert('No se pudo descargar el PDF.');
      }
    });
  }

  downloadExcel(): void {
    this.api.getUsersExcel().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_report_${new Date().toISOString().slice(0,19)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar Excel', err);
        alert('No se pudo descargar el Excel.');
      }
    });
  }

}
