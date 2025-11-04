import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';
import { ProductCreateComponent } from '../product-create/product-create.component';
import { ProductEditComponent } from '../product-edit/product-edit.component';

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.css']
})
export class ProductManagementComponent implements OnInit {
  displayedColumns: string[] = ['id', 'nombre', 'descripcion', 'costo_por_hora', 'fecha_registro', 'actions'];
  dataSource = new MatTableDataSource<any>([]);
  newProduct: any = {};
  isAdmin: boolean = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadProducts();

    // 🔑 Ajuste: normalizar el rol para aceptar "admin" o "Administrador"
    const role = this.authService.getUserRole();
    if (role) {
      const normalizedRole = role.toString().toLowerCase();
      this.isAdmin = normalizedRole === 'admin' || normalizedRole === 'administrador';
    }
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (res) => {
        this.dataSource.data = res || [];
        this.dataSource.paginator = this.paginator;
      },
      error: (err) => {
        console.error('Error cargando productos', err);
      }
    });
  }

  // 👉 Ahora la creación se hace desde el modal
  openCreateProductModal(): void {
    const dialogRef = this.dialog.open(ProductCreateComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadProducts();
      }
    });
  }

  // 👉 Ahora la edición se hace desde el modal
  openEditProductModal(product: any): void {
    const dialogRef = this.dialog.open(ProductEditComponent, {
      width: '400px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: product
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'success') {
        this.loadProducts();
      }
    });
  }

  deleteProduct(productId: number): void {
    if (this.isAdmin && confirm('¿Seguro que deseas eliminar este producto?')) {
      this.productService.deleteProduct(productId).subscribe({
        next: () => {
          this.loadProducts();
        },
        error: (err) => {
          console.error('Error eliminando producto', err);
        }
      });
    }
  }

  downloadPDF(): void {
    this.productService.getProductsPDF().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products_report_${new Date().toISOString().slice(0,19)}.pdf`;
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
    this.productService.getProductsExcel().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products_report_${new Date().toISOString().slice(0,19)}.xlsx`;
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

