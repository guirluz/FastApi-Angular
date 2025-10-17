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

# 👇 Imports de tu proyecto
from app.logger import log
from app.database.connection import engine
from app.models.user import User

# 👇 Librerías externas necesarias
import pandas as pd
import bcrypt
from sqlalchemy.orm import sessionmaker
import glob
import datetime
import redis
import json

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
def process_excel_task(self, file_path: str):
    """
    Procesa un archivo Excel con columnas: username, email, password.
    Inserta usuarios en la tabla 'users' con contraseña hasheada.
    Además, actualiza el estado de la tarea y publica progreso en Redis
    para que FastAPI lo reenvíe vía WebSocket.
    """
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    try:
        log.info(f"Procesando archivo Excel en ruta: {file_path}")

        # Leer Excel (pandas detecta engine según extensión)
        df = pd.read_excel(file_path)

        # Normalizar nombres de columnas a minúsculas
        df.columns = [c.lower() for c in df.columns]

        required_columns = {"username", "email", "password"}
        if not required_columns.issubset(df.columns):
            raise ValueError(f"El archivo Excel debe contener las columnas: {required_columns}")

        total = len(df)
        inserted = 0
        skipped = []

        for i, row in df.iterrows():
            # ⚠️ El sleep es solo para pruebas visuales, puedes quitarlo en producción
            # sleep(0.5)

            # Actualiza estado en Celery (visible vía /task-status)
            self.update_state(state="PROGRESS", meta={"current": i + 1, "total": total})

            # Publica progreso en Redis (para WebSocket en FastAPI)
            redis_client.publish("progress_channel", json.dumps({
                "type": "progress",
                "task_id": self.request.id,
                "current": i + 1,
                "total": total
            }))

            username = str(row["username"]).strip()
            email = str(row["email"]).strip()
            password = str(row["password"]).strip()

            if not username or not email or not password:
                skipped.append({"row": i + 1, "reason": "Campos incompletos"})
                continue

            existing = session.query(User).filter(User.email == email).first()
            if existing:
                log.warning(f"Fila {i+1}: email duplicado {email}, se omite")
                skipped.append({"row": i + 1, "reason": "Duplicado"})
                continue

            hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

            new_user = User(
                username=username,
                email=email,
                password_hash=hashed_pw.decode("utf-8")
            )
            session.add(new_user)
            inserted += 1

            if (i + 1) % 50 == 0:
                session.commit()

        session.commit()
        log.success(f"Importación completada: {inserted} usuarios insertados, {len(skipped)} omitidos")

        # Publica mensaje final de éxito
        redis_client.publish("progress_channel", json.dumps({
            "type": "progress",
            "task_id": self.request.id,
            "current": total,
            "total": total,
            "status": "completed"
        }))

        return {"status": "completed", "rows": inserted, "skipped": skipped}

    except Exception as e:
        session.rollback()
        log.error(f"Error procesando Excel: {e}")

        # Publica error en Redis
        redis_client.publish("progress_channel", json.dumps({
            "type": "progress",
            "task_id": self.request.id,
            "error": str(e),
            "status": "failed"
        }))
        raise e
    finally:
        session.close()


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
