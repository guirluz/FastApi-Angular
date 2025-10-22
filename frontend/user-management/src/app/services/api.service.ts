import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ 
  providedIn: 'root' 
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ==========================================
  // MÉTODOS DE AUTENTICACIÓN
  // ==========================================
  
  register(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register`, user);
  }

  login(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, user);
  }

  // ==========================================
  // MÉTODOS DE USUARIOS
  // ==========================================

  getUsers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users`);
  }

  createUser(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, user);
  }

  updateUser(id: number, user: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, user);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`);
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/me`, {
      headers: { 
        Authorization: `Bearer ${localStorage.getItem('access_token')}` 
      }
    });
  }

  // ==========================================
  // MÉTODOS DE IMPORTACIÓN EXCEL
  // ==========================================

  uploadExcel(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/upload-excel`, formData);
  }

  getTaskStatus(taskId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/task-status/${taskId}`);
  }
}