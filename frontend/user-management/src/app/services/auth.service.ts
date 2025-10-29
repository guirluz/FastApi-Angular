import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface LoginResponse {
  token: string;
  role: string;
  username?: string;
  refresh_token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = 'http://localhost:8000';
  private apiUrl = `${this.baseUrl}/auth`;
  
  constructor(private router: Router, private http: HttpClient) {}

  // 👇 CORREGIDO: Cambiar role: string a role_id: number
  register(user: { username: string, email: string, password: string, role_id: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  login(credentials: { username: string, password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: LoginResponse) => {
        localStorage.setItem('access_token', response.token);
        localStorage.setItem('role', response.role);
        if (response.username) {
          localStorage.setItem('username', response.username);
        }
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('refresh_token');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  getRoles(): Observable<any> {
    return this.http.get(`${this.baseUrl}/auth/roles`);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getUsername(): string | null {
    return localStorage.getItem('username');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  getUserRole(): string | null {
    return this.getRole();
  }
}



