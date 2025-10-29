import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-user-import',
  templateUrl: './user-import.component.html',
  styleUrls: ['./user-import.component.css']
})
export class UserImportComponent implements OnDestroy {
  @Output() importCompleted = new EventEmitter<void>();

  selectedFile: File | null = null;
  progress = 0;
  taskId: string | null = null;
  ws!: WebSocket;
  isUploading = false;
  statusMessage = '';

  // Validación y preview
  isFileValid = false;
  previewData: any[] = [];

  // Multi-hoja
  sheets: Array<{
    sheet_name: string;
    total_rows: number;
    columns: string[];
    preview: any[];
    data?: any[];
  }> = [];
  selectedSheetIndex = 0;
  excludedSheets = new Set<string>();
  validatedFilename: string | null = null;

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
      this.snackBar.open('Solo se permiten archivos Excel (.xls, .xlsx)', 'Cerrar', { duration: 4000 });
      return;
    }

    if (file.size > maxSize) {
      this.snackBar.open('El archivo excede el tamaño máximo de 5MB', 'Cerrar', { duration: 4000 });
      return;
    }

    this.selectedFile = file;
    // Reinicio estado multi-hoja
    this.sheets = [];
    this.selectedSheetIndex = 0;
    this.excludedSheets.clear();
    this.validatedFilename = null;
    this.previewData = [];
    this.validateFile(file);
  }

  // Validación previa con backend (multi-hoja)
  validateFile(file: File): void {
    this.isUploading = true;
    this.statusMessage = 'Validando archivo...';

    const formData = new FormData();
    formData.append('file', file);

    this.api.validateExcel(formData).subscribe({
      next: (res: any) => {
        console.log('Respuesta validación:', res);

        const ok = (res.status === 200 || res.status === 'success') && res.data?.sheets?.length > 0;
        if (ok) {
          this.isFileValid = true;
          this.sheets = res.data.sheets || [];
          this.validatedFilename = res.data.filename || null;

          // Preview inicial: primera hoja válida
          this.selectedSheetIndex = 0;
          this.previewData = this.sheets[0]?.preview || [];

          this.snackBar.open(`${this.sheets.length} hoja(s) válida(s) encontrada(s)`, 'Cerrar', { duration: 3000 });
          this.statusMessage = 'Archivo validado correctamente';
        } else {
          this.isFileValid = false;
          this.previewData = [];
          this.sheets = [];
          this.validatedFilename = null;
          this.snackBar.open('El archivo no tiene la estructura esperada', 'Cerrar', { duration: 4000 });
          this.statusMessage = 'Archivo inválido';
        }
        this.isUploading = false;
      },
      error: (err) => {
        console.error('Error validando archivo:', err);
        this.snackBar.open('Error al validar el archivo', 'Cerrar', { duration: 4000 });
        this.isFileValid = false;
        this.previewData = [];
        this.sheets = [];
        this.validatedFilename = null;
        this.isUploading = false;
        this.statusMessage = '';
      }
    });
  }

  // Seleccionar hoja activa para preview
  selectSheet(index: number): void {
    if (index < 0 || index >= this.sheets.length) return;
    this.selectedSheetIndex = index;
    this.previewData = this.sheets[index]?.preview || [];
  }

  // Excluir/Incluir hoja de la importación
  toggleExcludeCurrentSheet(): void {
    const name = this.sheets[this.selectedSheetIndex]?.sheet_name;
    if (!name) return;
    if (this.excludedSheets.has(name)) {
      this.excludedSheets.delete(name);
      this.snackBar.open(`Hoja '${name}' incluida nuevamente`, 'Cerrar', { duration: 2500 });
    } else {
      this.excludedSheets.add(name);
      this.snackBar.open(`Hoja '${name}' excluida de la importación`, 'Cerrar', { duration: 2500 });
    }
  }

  // Flujo de importación
  uploadFile(): void {
    if (!this.selectedFile || !this.isFileValid) {
      this.snackBar.open('Selecciona y valida un archivo primero', 'Cerrar', { duration: 3000 });
      return;
    }

    const includedSheets = this.sheets.filter(s => !this.excludedSheets.has(s.sheet_name));

    if (includedSheets.length === 0) {
      this.snackBar.open('No hay hojas seleccionadas para importar', 'Cerrar', { duration: 3500 });
      return;
    }

    const useValidatedFlow = this.sheets.length > 1 || this.excludedSheets.size > 0;

    if (!useValidatedFlow) {
      // Mantener flujo original Celery + WebSocket
      this.isUploading = true;
      this.progress = 0;
      this.statusMessage = 'Subiendo archivo...';

      const formData = new FormData();
      formData.append('file', this.selectedFile);

      console.log('Subiendo archivo para importación:', this.selectedFile.name);

      this.api.uploadExcel(formData).subscribe({
        next: (response: any) => {
          console.log('Respuesta del backend:', response);
          this.taskId = response.data?.task_id || response.task_id;

          if (!this.taskId) {
            console.error('No se recibió task_id en la respuesta:', response);
            this.snackBar.open('Error: No se recibió ID de tarea', 'Cerrar', { duration: 4000 });
            this.isUploading = false;
            return;
          }

          this.statusMessage = 'Procesando archivo...';
          this.connectWebSocket();
        },
        error: (err) => {
          console.error('Error subiendo archivo:', err);
          this.snackBar.open('Error al subir el archivo', 'Cerrar', { duration: 4000 });
          this.isUploading = false;
          this.statusMessage = '';
        }
      });

      return;
    }

    // Flujo validado por hoja
    this.isUploading = true;
    this.progress = 0;
    this.statusMessage = 'Importando hojas seleccionadas...';

    const totalSheets = includedSheets.length;
    let completedSheets = 0;

    const importNext = (idx: number) => {
      if (idx >= totalSheets) {
        this.progress = 100;
        this.statusMessage = '¡Importación completada!';
        this.snackBar.open('Importación completada con éxito', 'Cerrar', { duration: 4000 });
        this.isUploading = false;

        this.importCompleted.emit();
        setTimeout(() => this.resetForm(), 1500);
        return;
      }

      const sheet = includedSheets[idx];
      const payload = {
        sheet_name: sheet.sheet_name,
        data: sheet.data && sheet.data.length ? sheet.data : (sheet.preview || [])
      };

      this.api.importValidatedData(payload).subscribe({
        next: (res: any) => {
          console.log(`Hoja '${sheet.sheet_name}' importada:`, res);
          completedSheets += 1;
          this.progress = Math.floor((completedSheets / totalSheets) * 100);
          this.statusMessage = `Importada hoja ${completedSheets}/${totalSheets}: '${sheet.sheet_name}'`;

          importNext(idx + 1);
        },
        error: (err) => {
          console.error(`Error importando hoja '${sheet.sheet_name}':`, err);
          this.snackBar.open(`Error importando '${sheet.sheet_name}': ${err?.error?.detail || 'ver logs'}`, 'Cerrar', { duration: 5000 });
          completedSheets += 1;
          this.progress = Math.floor((completedSheets / totalSheets) * 100);
          importNext(idx + 1);
        }
      });
    };

    importNext(0);
  }

    connectWebSocket(): void {
    console.log('🔌 Conectando WebSocket...');
    this.ws = new WebSocket('ws://localhost:8000/ws/notify');

    this.ws.onopen = () => {
      console.log('WebSocket conectado, esperando mensajes...');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Mensaje WebSocket recibido:', data);

      if (data.type === 'progress' && data.task_id === this.taskId) {
        this.progress = data.percent || 0;
        this.statusMessage = `Procesando: ${data.current}/${data.total} registros`;

        if (data.status === 'completed') {
          this.progress = 100;
          this.statusMessage = '¡Importación completada!';
          this.snackBar.open('Importación completada con éxito', 'Cerrar', { duration: 4000 });
          this.isUploading = false;
          this.ws.close();

          this.importCompleted.emit();

          setTimeout(() => {
            this.resetForm();
          }, 2000);
        } else if (data.status === 'failed') {
          this.statusMessage = 'Error en la importación';
          this.snackBar.open(`Error: ${data.error}`, 'Cerrar', { duration: 5000 });
          this.isUploading = false;
          this.ws.close();
        }
      }
    };

    this.ws.onerror = (error) => {
      console.error('Error en WebSocket:', error);
      this.snackBar.open('Error de conexión WebSocket', 'Cerrar', { duration: 4000 });
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
    this.isFileValid = false;

    // Multi-hoja reset
    this.previewData = [];
    this.sheets = [];
    this.selectedSheetIndex = 0;
    this.excludedSheets.clear();
    this.validatedFilename = null;

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  ngOnDestroy(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}









