import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private ws!: WebSocket;

  constructor(private snackBar: MatSnackBar, private zone: NgZone) {}

  connect(): void {
    // Ajusta la URL según tu backend (http → ws, https → wss)
    this.ws = new WebSocket('ws://localhost:8000/ws/notify');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Ejecutamos dentro de Angular zone para que actualice la UI
      this.zone.run(() => {
        this.snackBar.open(
          `🔔 ${data.event}: ${data.message}`,
          'Cerrar',
          { duration: 4000 }
        );
      });
    };

    this.ws.onclose = () => {
      console.warn('❌ WebSocket cerrado, reintentando en 5s...');
      setTimeout(() => this.connect(), 5000);
    };
  }
}

