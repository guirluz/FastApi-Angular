import { Component, EventEmitter, Output, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-user-import',
  templateUrl: './user-import.component.html',
  styleUrls: ['./user-import.component.css']
})
export class UserImportComponent implements OnDestroy {
  @Output() importCompleted = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  progress = 0;
  taskId: string | null = null;
  ws!: WebSocket;
  isUploading = false;
  statusMessage = '';

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

    // Validación de extensión
    if (!validExtensions.includes(ext)) {
      this.snackBar.open('❌ Solo se permiten archivos Excel (.xls, .xlsx)', 'Cerrar', { 
        duration: 4000,
        panelClass: ['snackbar-error']
      });
      this.clearFileInput();
      return;
    }

    // Validación de tamaño
    if (file.size > maxSize) {
      this.snackBar.open('❌ El archivo excede el tamaño máximo de 5MB', 'Cerrar', { 
        duration: 4000,
        panelClass: ['snackbar-error']
      });
      this.clearFileInput();
      return;
    }

    this.selectedFile = file;
    console.log('✅ Archivo seleccionado:', file.name);
    
    // Mostrar notificación de éxito
    this.snackBar.open(`📄 Archivo "${file.name}" listo para subir`, 'Cerrar', { 
      duration: 3000,
      panelClass: ['snackbar-success']
    });
  }

  uploadFile(): void {
    if (!this.selectedFile) {
      this.snackBar.open('⚠️ Selecciona un archivo primero', 'Cerrar', { 
        duration: 3000,
        panelClass: ['snackbar-warning']
      });
      return;
    }

    this.isUploading = true;
    this.progress = 0;
    this.statusMessage = 'Subiendo archivo...';

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    console.log('📤 Subiendo archivo:', this.selectedFile.name);

    this.api.uploadExcel(formData).subscribe({
      next: (response: any) => {
        console.log('📨 Respuesta del backend:', response);
        
        // El backend devuelve { code, message, data: { task_id } }
        this.taskId = response.data?.task_id || response.task_id;
        
        if (!this.taskId) {
          console.error('❌ No se recibió task_id en la respuesta:', response);
          this.snackBar.open('❌ Error: No se recibió ID de tarea', 'Cerrar', { 
            duration: 4000,
            panelClass: ['snackbar-error']
          });
          this.isUploading = false;
          return;
        }

        console.log('✅ Task ID recibido:', this.taskId);
        this.statusMessage = 'Procesando archivo...';
        this.connectWebSocket();
      },
      error: (err) => {
        console.error('❌ Error subiendo archivo:', err);
        const errorMsg = err.error?.message || 'Error al subir el archivo';
        this.snackBar.open(`❌ ${errorMsg}`, 'Cerrar', { 
          duration: 5000,
          panelClass: ['snackbar-error']
        });
        this.isUploading = false;
        this.statusMessage = '';
      }
    });
  }

  connectWebSocket(): void {
    console.log('🔌 Conectando WebSocket...');
    this.ws = new WebSocket('ws://localhost:8000/ws/notify');

    this.ws.onopen = () => {
      console.log('✅ WebSocket conectado, esperando mensajes...');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Mensaje WebSocket recibido:', data);

      // Verifica que sea del tipo 'progress' y de nuestra tarea
      if (data.type === 'progress' && data.task_id === this.taskId) {
        console.log(`📊 Progreso: ${data.current}/${data.total} (${data.percent}%)`);

        this.progress = data.percent || 0;
        this.statusMessage = `Procesando: ${data.current}/${data.total} registros`;

        if (data.status === 'completed') {
          console.log('✅ Importación completada');
          this.progress = 100;
          this.statusMessage = '¡Importación completada!';
          
          this.snackBar.open('✅ Importación completada con éxito', 'Cerrar', { 
            duration: 4000,
            panelClass: ['snackbar-success']
          });
          
          this.isUploading = false;
          this.ws.close();
          
          // Avisamos al padre que debe refrescar la tabla
          this.importCompleted.emit();
          
          // Resetear después de 3 segundos para que el usuario vea el progreso completo
          setTimeout(() => {
            this.resetForm();
          }, 3000);
          
        } else if (data.status === 'failed') {
          console.error('❌ Error en la tarea:', data.error);
          this.statusMessage = 'Error en la importación';
          
          this.snackBar.open(`❌ Error: ${data.error}`, 'Cerrar', { 
            duration: 5000,
            panelClass: ['snackbar-error']
          });
          
          this.isUploading = false;
          this.ws.close();
          
          // Resetear el formulario también en caso de error
          setTimeout(() => {
            this.resetForm();
          }, 2000);
        }
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Error en WebSocket:', error);
      this.snackBar.open('❌ Error de conexión WebSocket', 'Cerrar', { 
        duration: 4000,
        panelClass: ['snackbar-error']
      });
      this.isUploading = false;
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket cerrado');
    };
  }

  resetForm(): void {
    this.selectedFile = null;
    this.progress = 0;
    this.taskId = null;
    this.statusMessage = '';
    this.clearFileInput();
    
    console.log('🔄 Formulario reiniciado');
  }

  clearFileInput(): void {
    // Limpiar el input de archivo usando ViewChild
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  ngOnDestroy(): void {
    // Cerrar WebSocket al destruir el componente
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 Cerrando WebSocket al destruir componente');
      this.ws.close();
    }
  }
}