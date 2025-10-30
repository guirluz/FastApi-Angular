import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-create',
  templateUrl: './product-create.component.html',
  styleUrls: ['./product-create.component.css']
})
export class ProductCreateComponent {
  nombre = '';
  descripcion = '';
  costo_por_hora: number | null = null;

  constructor(
    private productService: ProductService,
    private dialogRef: MatDialogRef<ProductCreateComponent>
  ) {}

  createProduct(): void {
    const productData = {
      nombre: this.nombre,
      descripcion: this.descripcion,
      costo_por_hora: this.costo_por_hora
    };

    this.productService.createProduct(productData).subscribe({
      next: () => {
        this.dialogRef.close('success');
      },
      error: (err) => {
        console.error('❌ Error al crear producto', err);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
