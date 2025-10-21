import { Injectable, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProgressService implements OnDestroy {
  private socket: WebSocket | null = null;

  connect(onMessage: (data: any) => void): void {
    this.socket = new WebSocket(environment.wsUrl);

    this.socket.onopen = () => console.log('WS conectado:', environment.wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') onMessage(data);
      } catch (e) {
        console.error('Error WS', e);
      }
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}

