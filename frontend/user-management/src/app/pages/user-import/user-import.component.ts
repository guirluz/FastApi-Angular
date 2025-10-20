import { Component, EventEmitter, Output } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-user-import',
  templateUrl: './user-import.component.html',
  styleUrls: ['./user-import.component.css']
})
export class UserImportComponent {
  @Output() importCompleted = new EventEmitter<void>();

  selectedFile: File | null = null;
  progress = 0;
  taskId: string | null = null;
  ws!: WebSocket;
  isUploading = false;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5 MB
    const validExtensions = ['.xls', '.xlsx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      this.snackBar.open('❌ Solo se permiten archivos Excel (.xls, .xlsx)', 'Cerrar', { duration: 4000 });
      return;
    }

    if (file.size > maxSize) {
      this.snackBar.open('❌ El archivo excede el tamaño máximo de 5MB', 'Cerrar', { duration: 4000 });
      return;
    }

    this.selectedFile = file;
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.progress = 0;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.api.uploadExcel(formData).subscribe({
      next: (res: any) => {
        this.taskId = res.task_id;
        this.connectWebSocket();
      },
      error: (err) => {
        console.error('❌ Error subiendo archivo', err);
        this.snackBar.open('❌ Error al subir el archivo', 'Cerrar', { duration: 4000 });
        this.isUploading = false;
      }
    });
  }

  connectWebSocket(): void {
    this.ws = new WebSocket('ws://localhost:8000/ws/notify');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.task_id === this.taskId) {
        if (data.status === 'completed') {
          this.progress = 100;
          this.snackBar.open('✅ Importación completada con éxito', 'Cerrar', { duration: 4000 });
          this.isUploading = false;
          this.ws.close();
          // 🔑 Avisamos al padre que debe refrescar la tabla
          this.importCompleted.emit();
        } else if (data.status === 'failed') {
          console.error('❌ Error en la tarea', data.error);
          this.snackBar.open(`❌ Error en la importación: ${data.error}`, 'Cerrar', { duration: 5000 });
          this.isUploading = false;
          this.ws.close();
        } else if (data.type === 'progress') {
          const current = data.current || 0;
          const total = data.total || 1;
          this.progress = Math.round((current / total) * 100);
        }
      }
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket cerrado');
    };
  }
}



