import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';

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
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.isAdmin = this.authService.getUserRole() === 'admin';
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

  createProduct(): void {
    if (this.isAdmin && this.newProduct.nombre && this.newProduct.costo_por_hora) {
      this.productService.createProduct(this.newProduct).subscribe({
        next: (res) => {
          this.loadProducts();
          this.newProduct = {};
        },
        error: (err) => {
          console.error('Error creando producto', err);
        }
      });
    }
  }

  updateProduct(product: any): void {
    if (this.isAdmin) {
      this.productService.updateProduct(product.id, product).subscribe({
        next: () => {
          this.loadProducts();
        },
        error: (err) => {
          console.error('Error actualizando producto', err);
        }
      });
    }
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

  rentProduct(product: any, hours: number): void {
    const rental = {
      product_id: product.id,
      horas_rentadas: hours
    };
    this.productService.rentProduct(rental).subscribe({
      next: (res) => {
        console.log('Renta exitosa', res);
      },
      error: (err) => {
        console.error('Error rentando producto', err);
      }
    });
  }
}
