import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-product-edit',
  templateUrl: './product-edit.component.html',
  styleUrls: ['./product-edit.component.css']
})
export class ProductEditComponent {
  product: { id: number; nombre: string; descripcion: string; costo_por_hora: number } = {
    id: 0,
    nombre: '',
    descripcion: '',
    costo_por_hora: 0
  };

  constructor(
    private productService: ProductService,
    private dialogRef: MatDialogRef<ProductEditComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    if (data) {
      this.product = { ...data };
    }
  }

  updateProduct(): void {
    const payload = {
      nombre: this.product.nombre,
      descripcion: this.product.descripcion,
      costo_por_hora: this.product.costo_por_hora
    };

    this.productService.updateProduct(this.product.id, payload).subscribe({
      next: () => {
        this.dialogRef.close('success');
      },
      error: (err) => {
        console.error('❌ Error al actualizar producto', err);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
