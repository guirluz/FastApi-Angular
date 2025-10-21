import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private ws!: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private snackBar: MatSnackBar, private zone: NgZone) {}

  connect(): void {
    // Ajusta la URL según tu backend (http → ws, https → wss)
    this.ws = new WebSocket('ws://localhost:8000/ws/notify');

    this.ws.onopen = () => {
      console.log('✅ WebSocket de notificaciones conectado');
      this.reconnectAttempts = 0; // Reset contador
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Notificación recibida:', data);

      // Solo muestra notificaciones de login/register, NO de progress
      if (data.type === 'login' || data.type === 'register') {
        this.zone.run(() => {
          this.snackBar.open(
            `🔔 ${data.type === 'login' ? 'Login' : 'Registro'}: ${data.message}`,
            'Cerrar',
            { 
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            }
          );
        });
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Error en WebSocket:', error);
    };

    this.ws.onclose = () => {
      console.warn('❌ WebSocket cerrado');
      
      // Reintentar con backoff exponencial
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`🔄 Reintentando en ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('❌ Máximo de reintentos alcanzado');
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      console.log('🔌 WebSocket desconectado manualmente');
    }
  }
}

