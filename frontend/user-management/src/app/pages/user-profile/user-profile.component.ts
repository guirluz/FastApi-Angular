import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  user: any = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getProfile().subscribe({
      next: (res: any) => {
        // Ajuste: tipamos la respuesta como any para evitar el error de compilación
        this.user = res.data;
      },
      error: (err) => {
        console.error('Error cargando perfil', err);
      }
    });
  }
}
