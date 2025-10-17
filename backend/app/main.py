"""
Aplicación FastAPI centralizada con:
- Endpoints de autenticación (login, registro, refresh).
- CRUD de usuarios.
- Importación de usuarios vía Excel usando Celery.
- WebSocket de notificaciones en tiempo real (login/registro).
- CORS habilitado para el frontend Angular.
- Comentarios y docstrings para comprensión media/baja.
"""

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import bcrypt
from datetime import datetime, timedelta
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import asyncio  # Operaciones async para WebSocket
import json
import redis.asyncio as aioredis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

from app.database.connection import engine, Base, get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserUpdate
from app.logger import log
from app.utils.responses import build_response
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_MINUTES

# Celery (tareas pesadas)
from app.tasks import generar_reporte_usuarios, celery_app, process_excel_task
from celery.result import AsyncResult


# =========================
# Inicialización de la app
# =========================
app = FastAPI()

# =========================
# Configuración de CORS
# =========================
origins = ["http://localhost:4200", "http://127.0.0.1:4200"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # dominios permitidos (frontend Angular)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Creación/Verificación de tablas
# =========================
try:
    Base.metadata.create_all(bind=engine)
    log.success("Tablas creadas/verificadas correctamente en la base de datos")
except Exception as e:
    log.error(f"Error al crear/verificar tablas: {e}")

# =========================
# Gestión de WebSocket
# =========================
class ConnectionManager:
    """
    Maneja las conexiones WebSocket activas y permite enviarles mensajes.
    - connect(ws): registra un cliente.
    - disconnect(ws): elimina un cliente.
    - broadcast(message): envía un dict/str a todos los clientes conectados.
    Nota: esto es suficiente para un canal sencillo de notificaciones globales.
    """
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        log.info(f"Cliente WebSocket conectado. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass
        log.info(f"Cliente WebSocket desconectado. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict | str):
        """
        Envía el mismo mensaje a todos los clientes conectados.
        Se usa para notificaciones globales (login, registro).
        """
        for ws in list(self.active_connections):
            try:
                if isinstance(message, dict):
                    await ws.send_json(message)
                else:
                    await ws.send_text(message)
            except Exception as e:
                log.warning(f"Fallo al enviar a un cliente WebSocket: {e}")
                self.disconnect(ws)

# Instancia global del manager (simple y suficiente para este caso)
ws_manager = ConnectionManager()

@app.websocket("/ws/notify")
async def websocket_notify(websocket: WebSocket):
    """
    Canal WebSocket para notificaciones en tiempo real.
    El frontend se conecta aquí y recibe JSON como:
    {
      "type": "login",
      "message": "Inicio de sesión correcto",
      "user": "email@dominio",
      "timestamp": "2024-01-01T00:00:00Z"
    }
    """
    await ws_manager.connect(websocket)
    try:
        # Mantiene la conexión. No esperamos mensajes del cliente,
        # pero leer evita cierres por timeout en algunos proxies.
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        log.error(f"Error en WebSocket /ws/notify: {e}")
        ws_manager.disconnect(websocket)

# =========================
# Suscripción a Redis Pub/Sub y reenvío a WebSocket
# =========================
@app.on_event("startup")
async def startup_event():
    """
    Al iniciar FastAPI, se suscribe al canal de Redis 'progress_channel'
    y reenvía cada mensaje a los clientes WebSocket conectados.
    """
    async def redis_listener():
        try:
            redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            pubsub = redis.pubsub()
            await pubsub.subscribe("progress_channel")

            log.info("Suscrito a canal Redis: progress_channel")

            async for message in pubsub.listen():
                if message.get("type") == "message":
                    try:
                        data = json.loads(message.get("data", "{}"))
                        # Reenvía al WebSocket
                        await ws_manager.broadcast(data)
                    except Exception as e:
                        log.error(f"Error procesando mensaje Redis: {e}")
        except Exception as e:
            log.error(f"Listener Redis falló: {e}")

    # Levanta el listener en segundo plano
    asyncio.create_task(redis_listener())

# =========================
# Utilidades JWT
# =========================
def create_token(data: dict, expires_delta: timedelta):
    """
    Crea un token JWT con expiración.
    - data: payload base (ej: {"sub": email})
    - expires_delta: duración (timedelta)
    """
    try:
        to_encode = data.copy()
        expire = datetime.utcnow() + expires_delta
        to_encode.update({"exp": expire})
        token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        log.debug(f"Token creado para {data.get('sub')}")
        return token
    except Exception as e:
        log.error(f"Error al crear token: {e}")
        raise

# =========================
# Endpoints de prueba y DB
# =========================
@app.get("/saludo")
def saludo():
    """Endpoint simple para verificar que la API responde."""
    try:
        log.info("Se llamó al endpoint /saludo")
        return build_response(200, "Éxito", {"mensaje": "Hola desde FastAPI"})
    except Exception as e:
        log.error(f"Error en /saludo: {e}")
        return build_response(500, "Error interno del servidor")

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    """Verifica conexión a MySQL usando SQLAlchemy."""
    try:
        db.execute("SELECT 1")
        log.success("Conexión exitosa a MySQL con SQLAlchemy")
        return build_response(200, "Conexión exitosa a MySQL")
    except Exception as e:
        log.error(f"Error en conexión DB: {e}")
        return build_response(500, "Error en la conexión a la base de datos")

# =========================
# Endpoints de autenticación
# =========================
@app.post("/auth/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en la base de datos.
    Emite una notificación WebSocket al frontend cuando el registro es exitoso.
    """
    try:
        hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
        new_user = User(username=user.username, email=user.email, password_hash=hashed_pw.decode("utf-8"))
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        log.success(f"Usuario registrado: {new_user.email}")

        # Notificación en tiempo real
        await ws_manager.broadcast({
            "type": "register",
            "message": "Usuario registrado correctamente",
            "user": new_user.email,
            "timestamp": datetime.utcnow().isoformat()
        })

        return build_response(200, "Usuario registrado correctamente", {"id": new_user.id, "email": new_user.email})
    except Exception as e:
        log.error(f"Error en registro: {e}")
        return build_response(500, "Error interno al registrar usuario")

@app.post("/auth/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Autentica un usuario y devuelve access y refresh tokens.
    Emite una notificación WebSocket al frontend cuando el login es exitoso.
    """
    try:
        db_user = db.query(User).filter(User.email == user.email).first()
        if not db_user:
            log.warning(f"Usuario no encontrado: {user.email}")
            return build_response(404, "Usuario no encontrado")

        if not bcrypt.checkpw(user.password.encode("utf-8"), db_user.password_hash.encode("utf-8")):
            log.warning(f"Contraseña incorrecta para {user.email}")
            return build_response(400, "Contraseña incorrecta")

        access_token = create_token({"sub": db_user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        refresh_token = create_token({"sub": db_user.email}, timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES))

        log.info(f"Usuario {db_user.email} inició sesión")

        # Notificación en tiempo real
        await ws_manager.broadcast({
            "type": "login",
            "message": "Inicio de sesión correcto",
            "user": db_user.email,
            "timestamp": datetime.utcnow().isoformat()
        })

        return build_response(200, "Login exitoso", {"access_token": access_token, "refresh_token": refresh_token})
    except Exception as e:
        log.error(f"Error en login: {e}")
        return build_response(500, "Error interno en login")

@app.post("/auth/refresh")
def refresh_token(refresh_token: str):
    """
    Genera un nuevo access token a partir de un refresh token válido.
    (Operación silenciosa: no emite notificación WebSocket).
    """
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            log.warning("Refresh token inválido")
            return build_response(401, "Refresh token inválido")
    except JWTError as e:
        log.warning(f"Refresh token inválido o expirado: {e}")
        return build_response(401, "Refresh token inválido o expirado")

    new_access_token = create_token({"sub": email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    log.info(f"Nuevo access token generado para {email}")
    return build_response(200, "Token renovado", {"access_token": new_access_token})

# =========================
# CRUD de Usuarios (protegidos)
# =========================
oauth2_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)):
    """
    Obtiene el usuario actual a partir del token JWT.
    Lanza 401 si el token es inválido/expirado o si el usuario no existe.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            log.warning("Token recibido sin 'sub'")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")
    except JWTError as e:
        log.warning(f"Error al decodificar token: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        log.warning(f"Token válido pero usuario no encontrado en DB: {email}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    log.info(f"Usuario autenticado correctamente: {email}")
    return user

@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    """Devuelve la información del usuario autenticado."""
    try:
        log.info(f"Acceso al endpoint /users/me por {current_user.email}")
        return build_response(200, "Usuario autenticado", {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email
        })
    except Exception as e:
        log.error(f"Error en /users/me: {e}")
        return build_response(500, "Error interno en /users/me")

@app.post("/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Crea un nuevo usuario en la base de datos (parte del CRUD)."""
    try:
        existing_user = db.query(User).filter(User.email == user.email).first()
        if existing_user:
            return build_response(400, "El correo ya está registrado")

        hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
        new_user = User(
            username=user.username,
            email=user.email,
            password_hash=hashed_pw.decode("utf-8")
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return build_response(200, "Usuario creado correctamente", {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email
        })
    except Exception as e:
        log.error(f"Error en /users (POST): {e}")
        return build_response(500, "Error interno al crear usuario")

@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    """Lista todos los usuarios registrados."""
    try:
        users = db.query(User).all()
        if not users:
            return build_response(404, "No hay usuarios registrados")
        return build_response(200, "Usuarios obtenidos correctamente", [
            {"id": u.id, "username": u.username, "email": u.email} for u in users
        ])
    except Exception as e:
        log.error(f"Error en /users: {e}")
        return build_response(500, "Error interno al listar usuarios")

@app.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Obtiene un usuario por su ID."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return build_response(404, "Usuario no encontrado")
        return build_response(200, "Usuario obtenido correctamente", {
            "id": user.id,
            "username": user.username,
            "email": user.email
        })
    except Exception as e:
        log.error(f"Error en /users/{user_id}: {e}")
        return build_response(500, "Error interno al obtener usuario")

@app.put("/users/{user_id}")
def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db)):
    """Actualiza los datos de un usuario existente (parcial)."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return build_response(404, "Usuario no encontrado")

        if user_data.username is not None:
            user.username = user_data.username
        if user_data.email is not None:
            user.email = user_data.email
        if user_data.password is not None:
            user.password_hash = bcrypt.hashpw(
                user_data.password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

        db.commit()
        db.refresh(user)
        return build_response(200, "Usuario actualizado correctamente", {
            "id": user.id,
            "username": user.username,
            "email": user.email
        })
    except Exception as e:
        log.error(f"Error en /users/{user_id} (PUT): {e}")
        return build_response(500, "Error interno al actualizar usuario")

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Elimina un usuario por su ID."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return build_response(404, "Usuario no encontrado")

        db.delete(user)
        db.commit()
        return build_response(200, "Usuario eliminado correctamente", {"id": user_id})
    except Exception as e:
        log.error(f"Error en /users/{user_id} (DELETE): {e}")
        return build_response(500, "Error interno al eliminar usuario")

# =========================
# Importación Excel vía Celery
# =========================
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)  # asegúrate que exista la carpeta

@app.post("/upload-excel")
def upload_excel(file: UploadFile):
    """
    Sube un archivo Excel (XLS/XLSX) con columnas: username, email, password
    y encola la tarea de importación en Celery.
    """
    try:
        if not file.filename.endswith((".xls", ".xlsx")):
            return build_response(400, "Formato no soportado. Solo XLS/XLSX.")

        # Guardar en carpeta compartida
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())

        # Pasar la ruta a Celery
        task = process_excel_task.delay(file_path)
        log.info(f"Tarea de importación enviada a Celery, id={task.id}")
        return build_response(202, "Archivo recibido, procesando en segundo plano", {"task_id": task.id})

    except Exception as e:
        log.error(f"Error en /upload-excel: {e}")
        return build_response(500, "Error interno al subir Excel")

@app.get("/task-status/{task_id}")
def get_task_status(task_id: str):
    """
    Consulta el estado de la tarea de importación de Excel en Celery.
    Devuelve:
    - 202 si la tarea sigue en proceso (PENDING/PROGRESS)
    - 200 si la tarea terminó correctamente (SUCCESS)
    - 500 si la tarea falló (FAILURE)
    """
    try:
        task = celery_app.AsyncResult(task_id)

        if task.state == "PENDING":
            log.info(f"Tarea {task_id} pendiente")
            return build_response(202, "Tarea pendiente", {"state": task.state, "progress": {"current": 0, "total": 1}})

        elif task.state == "PROGRESS":
            info = task.info or {}
            current = info.get("current", 0)
            total = info.get("total", 1)
            log.info(f"Tarea {task_id} en progreso: {current}/{total}")
            return build_response(202, "Tarea en progreso", {"state": task.state, "progress": {"current": current, "total": total}})

        elif task.state == "SUCCESS":
            result = task.result or {}
            rows = result.get("rows", 0)
            skipped = result.get("skipped", [])
            log.success(f"Tarea {task_id} completada: {rows} insertados, {len(skipped)} omitidos")
            return build_response(200, "Tarea completada", {"state": task.state, "result": result, "progress": {"current": 1, "total": 1}})

        elif task.state == "FAILURE":
            log.error(f"Tarea {task_id} fallida: {task.info}")
            return build_response(500, "Tarea fallida", {"state": task.state, "error": str(task.info), "progress": {"current": 0, "total": 1}})

        else:
            log.warning(f"Tarea {task_id} en estado {task.state}")
            return build_response(202, f"Tarea en estado {task.state}", {"state": task.state, "progress": {"current": 0, "total": 1}})

    except Exception as e:
        log.error(f"Error al consultar estado de tarea {task_id}: {e}")
        return build_response(500, "Error interno al consultar estado", {"state": "ERROR", "progress": {"current": 0, "total": 1}})

# =========================
# Ejemplo de Celery simple
# =========================
@app.post("/reporte-usuarios")
def reporte_usuarios():
    """Genera un reporte de usuarios en segundo plano usando Celery."""
    try:
        task = generar_reporte_usuarios.delay()
        log.info(f"Tarea de reporte enviada a Celery, id={task.id}")
        return build_response(202, "Reporte en proceso", {"task_id": task.id})
    except Exception as e:
        log.error(f"Error al enviar tarea de reporte: {e}")
        return build_response(500, "Error interno al generar reporte")

@app.get("/status/{task_id}")
def get_status(task_id: str):
    """
    Consulta el estado de una tarea de Celery por su ID.
    Devuelve:
    - 202 si la tarea sigue en proceso
    - 200 si la tarea terminó correctamente
    - 500 si la tarea falló
    """
    try:
        task = celery_app.AsyncResult(task_id)

        if task.state == "PENDING":
            log.info(f"Tarea {task_id} aún en proceso")
            return build_response(202, "Tarea en proceso")

        elif task.state == "SUCCESS":
            log.success(f"Tarea {task_id} completada con éxito")
            return build_response(200, "Tarea completada", task.result)

        elif task.state == "FAILURE":
            log.error(f"Tarea {task_id} fallida: {task.info}")
            return build_response(500, "Tarea fallida", {"error": str(task.info)})

        else:
            log.warning(f"Tarea {task_id} en estado {task.state}")
            return build_response(202, f"Tarea en estado {task.state}")

    except Exception as e:
        log.error(f"Error al consultar estado de tarea {task_id}: {e}")
        return build_response(500, "Error interno al consultar estado")
