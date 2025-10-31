import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(
    public auth: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Conectar WebSocket de notificaciones al iniciar la app
    this.notificationService.connect();
    console.log('Rol actual en localStorage:', this.auth.getRole());
  }

  logout(): void {
    this.auth.logout();
  }

  isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }
}

