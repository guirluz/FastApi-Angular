import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.css']
})
export class ProductManagementComponent implements OnInit {
  products: any[] = [];
  newProduct: any = {};
  isAdmin: boolean = false;

  constructor(
    private productService: ProductService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadProducts();
    this.isAdmin = this.authService.getUserRole() === 'admin';
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe(
      (data) => {
        this.products = data;
      },
      (error) => {
        console.error('Error loading products', error);
      }
    );
  }

  createProduct(): void {
    if (this.isAdmin) {
      this.productService.createProduct(this.newProduct).subscribe(
        (response) => {
          this.products.push(response);
          this.newProduct = {};
        },
        (error) => {
          console.error('Error creating product', error);
        }
      );
    }
  }

  updateProduct(product: any): void {
    if (this.isAdmin) {
      this.productService.updateProduct(product.id, product).subscribe(
        (response) => {
          const index = this.products.findIndex(p => p.id === product.id);
          if (index !== -1) {
            this.products[index] = response;
          }
        },
        (error) => {
          console.error('Error updating product', error);
        }
      );
    }
  }

  deleteProduct(productId: number): void {
    if (this.isAdmin) {
      this.productService.deleteProduct(productId).subscribe(
        () => {
          this.products = this.products.filter(p => p.id !== productId);
        },
        (error) => {
          console.error('Error deleting product', error);
        }
      );
    }
  }

  rentProduct(product: any, hours: number): void {
    const rental = {
      product_id: product.id,
      horas_rentadas: hours
    };
    this.productService.rentProduct(rental).subscribe(
      (response) => {
        console.log('Rental successful', response);
        // Aquí podrías mostrar un mensaje de éxito o actualizar la UI
      },
      (error) => {
        console.error('Error renting product', error);
      }
    );
  }
}