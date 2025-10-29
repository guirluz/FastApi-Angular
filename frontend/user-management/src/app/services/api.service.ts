import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 👇 Flujo original: subir Excel y encolar tarea Celery
  uploadExcel(formData: FormData) {
    return this.http.post(`${this.baseUrl}/upload-excel`, formData);
  }

  // 👇 Consultar estado de tarea Celery
  getTaskStatus(taskId: string) {
    return this.http.get(`${this.baseUrl}/task-status/${taskId}`);
  }

  // 👇 CRUD de usuarios
  getUsers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/users`);
  }

  register(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/register`, user);
  }

  login(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, user);
  }

  deleteUser(id: number) {
    return this.http.delete(`${this.baseUrl}/users/${id}`);
  }

  updateUser(id: number, user: any) {
    return this.http.put(`${this.baseUrl}/users/${id}`, user);
  }

  getProfile() {
    return this.http.get(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
    });
  }

  createUser(user: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, user);
  }

  // 👇 Roles
  getRoles(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/roles`);
  }

  // 👇 Validación previa de Excel (estructura de columnas, hojas válidas)
  validateExcel(file: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/validate-excel`, file);
  }

  // 👇 Importación confirmada de datos validados
  importValidatedData(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/import-validated-data`, payload);
  }
  
}

