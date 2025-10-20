import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';

// Importamos los componentes que se abrirán en modal
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

  // Cargar usuarios en la tabla
  loadUsers(): void {
    this.api.getUsers().subscribe({
      next: (res) => {
        this.dataSource.data = res.data || [];
        this.dataSource.paginator = this.paginator;
      },
      error: (err) => {
        console.error('❌ Error cargando usuarios', err);
      }
    });
  }

  // Eliminar usuario
  deleteUser(userId: number): void {
    if (confirm('¿Seguro que deseas eliminar este usuario?')) {
      this.api.deleteUser(userId).subscribe({
        next: () => {
          this.loadUsers(); // recargar lista
        },
        error: () => {
          console.error('❌ Error al eliminar usuario');
        }
      });
    }
  }

  // Abrir modal para crear usuario
  openCreateUserModal(): void {
    const dialogRef = this.dialog.open(UserCreateComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadUsers(); // refrescar tabla si se creó un usuario
      }
    });
  }

  // Abrir modal para editar usuario
  openEditUserModal(user: any): void {
    const dialogRef = this.dialog.open(UserEditComponent, {
      width: '400px',
      data: user // pasamos el usuario seleccionado al modal
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadUsers(); // refrescar tabla si se editó un usuario
      }
    });
  }

  // 🔑 Método que se ejecuta cuando el importador emite el evento
  onImportCompleted(): void {
    this.loadUsers(); // refrescar tabla después de importar Excel
  }
}


