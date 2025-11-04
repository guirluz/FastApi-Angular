import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { RentalService } from '../../services/rental.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';


@Component({
  selector: 'app-rentals',
  templateUrl: './rentals.component.html',
  styleUrls: ['./rentals.component.css']
})
export class RentalsComponent implements OnInit {
  // Productos disponibles
  products: any[] = [];
  totalProducts = 0;
  page = 1;
  pageSize = 8;

  // Historial de rentas
  rentals: any[] = [];
  totalRentals = 0;
  rentalPage = 1;
  rentalPageSize = 8;

  // Estado del modal
  selectedProduct: any = null;
  horasRentadas: number = 1;
  costoTotal: number = 0;
  fechaDevolucion: string = '';

  constructor(
    private productService: ProductService,
    private rentalService: RentalService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadRentals();
  }


  onProductPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.loadProducts();
  }

  onRentalPageChange(event: PageEvent): void {
    this.rentalPage = event.pageIndex + 1;
    this.loadRentals();
  }

  // Cargar productos con paginación
  loadProducts(): void {
    this.productService.getAvailableProducts(this.page, this.pageSize).subscribe({
      next: (res) => {
        this.products = res.data.items;
        this.totalProducts = res.data.total;
      },
      error: () => {
        this.snackBar.open('Error al cargar productos', 'Cerrar', { duration: 3000 });
      }
    });
  }


  // Cargar historial de rentas
  loadRentals(): void {
    this.rentalService.getMyRentals(this.rentalPage, this.rentalPageSize).subscribe({
      next: (res) => {
        this.rentals = res.data.items;
        this.totalRentals = res.data.total;
      },
      error: () => {
        this.snackBar.open('Error al cargar historial de rentas', 'Cerrar', { duration: 3000 });
      }
    });
  }

  // Seleccionar producto en el modal
  selectProduct(product: any): void {
    this.selectedProduct = product;
    this.horasRentadas = 1;
    this.calculateTotals();
  }

  // Calcular costo total y fecha de devolución
  calculateTotals(): void {
    if (this.selectedProduct) {
      this.costoTotal = this.selectedProduct.costo_por_hora * this.horasRentadas;
      const fechaRenta = new Date();
      const fechaDev = new Date(fechaRenta.getTime() + this.horasRentadas * 60 * 60 * 1000);
      this.fechaDevolucion = fechaDev.toISOString();
    }
  }

  // Confirmar renta
  confirmRental(): void {
    if (!this.selectedProduct) return;

    const rental = {
      product_id: this.selectedProduct.id,
      horas_rentadas: this.horasRentadas
    };

    this.rentalService.createRental(rental).subscribe({
      next: (res) => {
        this.snackBar.open('Renta creada correctamente', 'Cerrar', { duration: 3000 });
        this.loadRentals(); // refrescar historial
        this.selectedProduct = null; // cerrar modal automáticamente
      },
      error: () => {
        this.snackBar.open('Error al crear la renta', 'Cerrar', { duration: 3000 });
      }
    });
  }


  downloadRentalsPDF(): void {
    this.rentalService.getRentalsPDF().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rentals_report_${new Date().toISOString().slice(0,19)}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error al descargar PDF', err);
        alert('No se pudo descargar el PDF.');
      }
    });
  }

  downloadRentalsExcel(): void {
    this.rentalService.getRentalsExcel().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rentals_report_${new Date().toISOString().slice(0,19)}.xlsx`;
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
