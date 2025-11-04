import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RentalService {
  private apiUrl = `${environment.apiUrl}/rentals`;

  constructor(private http: HttpClient) {}

  // Crear una nueva renta
  createRental(rental: any): Observable<any> {
    return this.http.post(this.apiUrl, rental);
  }

  // Obtener historial de rentas del cliente autenticado
  getMyRentals(page: number = 1, pageSize: number = 8): Observable<any> {
    return this.http.get(`${this.apiUrl}/me?page=${page}&page_size=${pageSize}`);
  }

  getRentalsPDF(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/rentals/export/pdf`, {
      responseType: 'blob'
    });
  }

  getRentalsExcel(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/rentals/export/excel`, {
      responseType: 'blob'
    });
  }

}
