import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

// Interfaces para la respuesta del backend
interface LoginData {
  token: string;
  role: string;
  username: string;
  refresh_token?: string;
}

interface ApiResponse {
  status: number;
  message: string;
  data: LoginData;
}

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

  register(user: { username: string, email: string, password: string, role: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  // 👇 CORREGIDO: Acepta email en lugar de username
  login(credentials: { email: string, password: string }): Observable<LoginResponse> {
    console.log('🔐 AuthService.login - Enviando credenciales:', { email: credentials.email });
    
    return this.http.post<ApiResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response: ApiResponse) => {
        console.log('✅ AuthService.login - Respuesta recibida:', response);
        
        // Extraer data de la respuesta
        const loginData = response.data;
        
        // Guardar en localStorage
        localStorage.setItem('access_token', loginData.token);
        localStorage.setItem('role', loginData.role);
        localStorage.setItem('username', loginData.username);
        
        if (loginData.refresh_token) {
          localStorage.setItem('refresh_token', loginData.refresh_token);
        }
        
        console.log('💾 Datos guardados en localStorage:', {
          token: loginData.token.substring(0, 20) + '...',
          role: loginData.role,
          username: loginData.username
        });
      }),
      // Transformar la respuesta para mantener compatibilidad
      map((response: ApiResponse) => {
        return {
          token: response.data.token,
          role: response.data.role,
          username: response.data.username,
          refresh_token: response.data.refresh_token
        } as LoginResponse;
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
    return this.http.get(`${this.apiUrl}/roles`);
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



