# backend/app/tasks.py
"""
Módulo de tareas en segundo plano usando Celery.
- Configura Celery con Redis como broker y backend.
- Define tareas de ejemplo (suma, reporte).
- Define tarea de importación de usuarios desde Excel.
- Publica progreso en Redis Pub/Sub para integrarse con WebSocket.
- Incluye tarea de limpieza diaria de archivos Excel.
"""

from celery import Celery
import os
from dotenv import load_dotenv
from time import sleep

# Imports de tu proyecto
from app.logger import log
from app.database.connection import engine
from app.models.user import User

# Librerías externas necesarias
import pandas as pd
import bcrypt
from sqlalchemy.orm import sessionmaker
import glob
import datetime
import redis
import json

# ====================

# ============================
# Configuración de entorno
# ============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Configuración de Celery con Redis (broker y backend)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# AGREGAR ESTA CONFIGURACIÓN
celery_app.conf.update(
    task_track_started=True,      # Habilita tracking desde el inicio
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    result_expires=3600,           # Resultados expiran en 1 hora
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Cliente Redis para Pub/Sub (para notificaciones WebSocket)
redis_client = redis.Redis.from_url(REDIS_URL)

# ============================
# Tareas de ejemplo
# ============================

@celery_app.task
def add(x, y):
    """Ejemplo simple: suma dos números."""
    return x + y


@celery_app.task
def generar_reporte_usuarios():
    """Ejemplo de tarea que simula generar un reporte."""
    log.info("Iniciando generación de reporte de usuarios...")
    sleep(5)
    log.success("Reporte de usuarios generado correctamente")
    return {"status": "Reporte listo"}


# ============================
# Nueva tarea: Importar usuarios desde Excel
# ============================

@celery_app.task(bind=True)
def process_excel_task(self, file_path: str, sheets_to_import: list = None):
    """
    Procesa un archivo Excel con columnas: username, email, password.
    Si se especifica sheets_to_import, solo procesa esas hojas.
    Inserta usuarios en la tabla 'users' con contraseña hasheada.
    Publica progreso en Redis para WebSocket.
    """
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        log.info(f"Procesando archivo Excel en ruta: {file_path}")

        xl = pd.ExcelFile(file_path)
        sheet_names = sheets_to_import if sheets_to_import else xl.sheet_names

        total = 0
        inserted = 0
        skipped = []

        # Contar filas totales de todas las hojas seleccionadas
        for sheet_name in sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [c.lower() for c in df.columns]
            required_columns = {"username", "email", "password"}
            if required_columns.issubset(df.columns):
                total += len(df)

        current = 0
        for sheet_name in sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            df.columns = [c.lower() for c in df.columns]
            required_columns = {"username", "email", "password"}
            if not required_columns.issubset(df.columns):
                log.warning(f"Hoja '{sheet_name}' ignorada: columnas inválidas")
                continue

            for i, row in df.iterrows():
                sleep(0.2)  # para ver progreso lento
                current += 1
                percent = int((current / total) * 100)

                self.update_state(state="PROGRESS", meta={"current": current, "total": total, "percent": percent})
                redis_client.publish("progress_channel", json.dumps({
                    "type": "progress",
                    "task_id": self.request.id,
                    "current": current,
                    "total": total,
                    "percent": percent,
                    "status": "processing"
                }))

                username = str(row["username"]).strip()
                email = str(row["email"]).strip()
                password = str(row["password"]).strip()

                if not username or not email or not password:
                    skipped.append({"row": i + 1, "sheet": sheet_name, "reason": "Campos incompletos"})
                    continue

                existing = session.query(User).filter(User.email == email).first()
                if existing:
                    skipped.append({"row": i + 1, "sheet": sheet_name, "reason": "Duplicado"})
                    continue

                hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
                new_user = User(username=username, email=email, password_hash=hashed_pw.decode("utf-8"))
                session.add(new_user)
                inserted += 1

                if inserted % 50 == 0:
                    session.commit()

        session.commit()
        redis_client.publish("progress_channel", json.dumps({
            "type": "completed",
            "task_id": self.request.id,
            "inserted": inserted,
            "skipped": skipped,
            "status": "completed"
        }))
        log.success(f"Importación completada: {inserted} usuarios insertados, {len(skipped)} omitidos")
        return {"status": "completed", "rows": inserted, "skipped": skipped}

    except Exception as e:
        session.rollback()
        redis_client.publish("progress_channel", json.dumps({
            "type": "progress",
            "task_id": self.request.id,
            "current": 0,
            "total": total if 'total' in locals() else 0,
            "percent": 0,
            "status": "failed",
            "error": str(e)
        }))
        raise e
    finally:
        session.close()

# -----------------------------------------------------------------
# Nueva tarea para excel, para la barra de carga
# -----------------------------------------------------------------

@celery_app.task(bind=True)
def process_excel_preview_task(self, file_path: str):
    """
    Lee todas las hojas del Excel y publica un mensaje 'preview' por Redis Pub/Sub
    con las hojas válidas (columnas requeridas), sus columnas y primeras filas.
    NO inserta en BD. Solo valida y prepara preview.
    """
    try:
        log.info(f"🔎 Validando Excel para preview: {file_path}")
        import pandas as pd

        xl = pd.ExcelFile(file_path)
        sheet_names = xl.sheet_names
        required_columns = {"username", "email", "password"}
        valid_sheets = []

        for sheet_name in sheet_names:
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                df.columns = [str(c).strip().lower() for c in df.columns]

                if required_columns.issubset(set(df.columns)):
                    df = df[list(required_columns)]
                    df = df.dropna(how='all')

                    # Máximo 100 registros para preview editable
                    records = df.head(100).to_dict('records')

                    valid_sheets.append({
                        "sheet_name": sheet_name,
                        "total_rows": int(len(df)),
                        "columns": list(df.columns),
                        "preview": records[:10],  # primeras 10 para vista rápida
                        "data": records           # hasta 100 para edición/confirmación
                    })
                    log.success(f"✅ Hoja válida: {sheet_name} ({len(df)} filas)")
                else:
                    log.warning(f"⚠️ Hoja sin columnas requeridas: {sheet_name} -> {list(df.columns)}")
            except Exception as e:
                log.error(f"❌ Error leyendo hoja '{sheet_name}': {e}")

        if not valid_sheets:
            # Publica fallo para que el frontend muestre error
            redis_client.publish("progress_channel", json.dumps({
                "type": "preview",
                "task_id": self.request.id,
                "status": "failed",
                "error": "Ninguna hoja tiene las columnas requeridas: username, email, password"
            }))
            # Opcionalmente también marca estado en Celery
            self.update_state(state="FAILURE", meta={"error": "Sin hojas válidas"})
            return {"status": "failed", "error": "Sin hojas válidas"}

        # Publica preview inicial
        payload = {
            "type": "preview",
            "task_id": self.request.id,
            "status": "ready",
            "sheets": valid_sheets,
            "total_sheets": len(sheet_names),
            "valid_sheets": len(valid_sheets)
        }
        redis_client.publish("progress_channel", json.dumps(payload))
        log.info(f"📤 Preview publicado (task_id={self.request.id}) con {len(valid_sheets)} hojas válidas")

        # Deja constancia de éxito
        self.update_state(state="SUCCESS", meta={"valid_sheets": len(valid_sheets)})
        return {"status": "success", "valid_sheets": len(valid_sheets)}

    except Exception as e:
        log.error(f"❌ Error en preview task: {e}")
        redis_client.publish("progress_channel", json.dumps({
            "type": "preview",
            "task_id": self.request.id,
            "status": "failed",
            "error": str(e)
        }))
        raise


# ============================
# Nueva tarea: Limpieza diaria de Excels
# ============================

@celery_app.task
def cleanup_excels():
    """
    Elimina archivos Excel de la carpeta /uploads que tengan más de 1 día.
    Se recomienda ejecutar esta tarea una vez al día (ej: medianoche).
    """
    folder = os.path.join(BASE_DIR, "app", "uploads")
    now = datetime.datetime.now()
    removed = []

    for file in glob.glob(os.path.join(folder, "*.xls*")):
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(file))
        if (now - mtime).days >= 1:
            os.remove(file)
            removed.append(file)

    log.info(f"Archivos Excel eliminados: {removed}")
    return {"removed": removed}
