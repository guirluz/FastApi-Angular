import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadExcel(formData: FormData) {
    return this.http.post(`${this.baseUrl}/upload-excel`, formData);
  }

  getTaskStatus(taskId: string) {
    return this.http.get(`${this.baseUrl}/task-status/${taskId}`);
  }

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
}
