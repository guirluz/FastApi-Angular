import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface LoginResponse {
  status?: number;
  message?: string;
  token?: string;
  role?: string;
  username?: string;
  refresh_token?: string;
  data?: {
    token: string;
    role: string;
    username?: string;
    refresh_token?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = 'http://localhost:8000';
  private apiUrl = `${this.baseUrl}/auth`;
  
  constructor(private router: Router, private http: HttpClient) {}

  // Registro de usuario con role_id
  register(user: { username: string; email: string; password: string; role_id: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  // Login corregido para soportar role en raíz o dentro de data
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: LoginResponse) => {
        console.log('🔍 Respuesta completa del login:', response);

        // Detectar si la respuesta trae "data" o está en la raíz
        const data = response.data ? response.data : response;

        if ((response.status === 200 || !response.status) && data) {
          console.log('💾 Guardando en localStorage:', {
            token: data.token,
            role: data.role,
            username: data.username
          });

          if (data.token) {
            localStorage.setItem('access_token', data.token);
          }
          if (data.role) {
            localStorage.setItem('role', data.role);
          }
          if (data.username) {
            localStorage.setItem('username', data.username);
          }
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }

          console.log('✅ Datos guardados. Verificando role:', localStorage.getItem('role'));
        } else {
          console.error('❌ Respuesta inesperada del login:', response);
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

  hasRole(role: string): boolean {
    const userRole = this.getRole();
    if (!userRole) return false;

    const normalized = userRole.toLowerCase().trim();

    // Diccionario de equivalencias
    const roleMap: { [key: string]: string } = {
      'administrador': 'admin',
      'admin': 'admin',
      'cliente': 'client',
      'client': 'client'
    };

    const mapped = roleMap[normalized];
    return mapped === role.toLowerCase();
  }

  
}
