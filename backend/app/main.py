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
from sqlalchemy import func, desc  # 👈 AGREGADO: Para estadísticas
from jose import jwt, JWTError
import bcrypt
from datetime import datetime, timedelta
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import asyncio
import json
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
background_tasks = set()

from app.database.connection import engine, Base, get_db
from app.models.user import User, Role, Product, Rental
from app.schemas.user import UserCreate, UserLogin, UserUpdate, RoleCreate, ProductCreate, RentalCreate
from app.logger import log
from app.utils.responses import build_response
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_MINUTES
from app.utils.auth import get_current_user, role_required

# Celery (tareas pesadas)
from app.tasks import generar_reporte_usuarios, celery_app, process_excel_task
from celery.result import AsyncResult

# =========================
# Inicialización de la app
# =========================
app = FastAPI()

# =========================
# Configuración de CORS - MEJORADA
# =========================
origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Solo dominios base, sin /*
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
        """Envía el mismo mensaje a todos los clientes conectados."""
        for ws in list(self.active_connections):
            try:
                if isinstance(message, dict):
                    await ws.send_json(message)
                else:
                    await ws.send_text(message)
            except Exception as e:
                log.warning(f"Fallo al enviar a un cliente WebSocket: {e}")
                self.disconnect(ws)

ws_manager = ConnectionManager()

@app.websocket("/ws/notify")
async def websocket_notify(websocket: WebSocket):
    """Canal WebSocket para notificaciones en tiempo real."""
    await ws_manager.connect(websocket)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        log.error(f"Error en WebSocket /ws/notify: {e}")
        ws_manager.disconnect(websocket)

# =========================
# Suscripción a Redis Pub/Sub
# =========================
@app.on_event("startup")
async def startup_event():
    """Suscripción a Redis para reenviar mensajes a WebSocket."""
    async def redis_listener():
        redis = None
        pubsub = None
        try:
            log.info("Iniciando listener de Redis...")
            redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
            pubsub = redis.pubsub()
            await pubsub.subscribe("progress_channel")
            
            log.success("Suscrito a canal Redis: progress_channel")
            
            async for message in pubsub.listen():
                if message and message.get("type") == "message":
                    try:
                        data = json.loads(message.get("data", "{}"))
                        log.info(f"Mensaje recibido de Redis: {data}")
                        await ws_manager.broadcast(data)
                        log.info(f"Mensaje reenviado a {len(ws_manager.active_connections)} clientes WebSocket")
                    except json.JSONDecodeError as e:
                        log.error(f"Error al parsear JSON de Redis: {e}")
                    except Exception as e:
                        log.error(f"Error procesando mensaje Redis: {e}")
                        
        except asyncio.CancelledError:
            log.warning("Listener Redis cancelado (shutdown)")
            raise
        except Exception as e:
            log.error(f"Listener Redis falló: {e}")
            import traceback
            log.error(traceback.format_exc())
        finally:
            log.info("🧹 Limpiando conexiones de Redis...")
            if pubsub:
                try:
                    await pubsub.unsubscribe("progress_channel")
                    await pubsub.close()
                    log.info("Pubsub cerrado")
                except Exception as e:
                    log.warning(f"Error cerrando pubsub: {e}")
            if redis:
                try:
                    await redis.close()
                    log.info("Redis cerrado")
                except Exception as e:
                    log.warning(f"Error cerrando redis: {e}")

    task = asyncio.create_task(redis_listener())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    
    log.info("Tarea de Redis listener iniciada en background")

@app.on_event("shutdown")
async def shutdown_event():
    """Cancela todas las tareas en background al cerrar FastAPI."""
    log.info("Cancelando tareas en background...")
    for task in background_tasks:
        task.cancel()
    await asyncio.gather(*background_tasks, return_exceptions=True)
    log.info("Todas las tareas canceladas correctamente")

# =========================
# Utilidades JWT
# =========================
def create_token(data: dict, expires_delta: timedelta):
    """Crea un token JWT con expiración."""
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
# Endpoints de prueba
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
    """
    try:
        # 👇 AGREGADO: Log para debug
        log.info(f"📥 Datos recibidos: username={user.username}, email={user.email}, role_id={user.role_id}")
        
        # Verificar si el usuario ya existe
        existing_user = db.query(User).filter(
            (User.email == user.email) | (User.username == user.username)
        ).first()
        
        if existing_user:
            log.warning(f"Intento de registro con email/username duplicado: {user.email}")
            return build_response(400, "El email o username ya está registrado")

        # 👇 AGREGADO: Verificar que el role_id existe
        role = db.query(Role).filter(Role.id == user.role_id).first()
        if not role:
            log.warning(f"Intento de registro con role_id inválido: {user.role_id}")
            return build_response(400, "El rol seleccionado no existe")

        hashed_pw = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
        
        # 👇 CORREGIDO: Incluir role_id
        new_user = User(
            username=user.username,
            email=user.email,
            password_hash=hashed_pw.decode("utf-8"),
            role_id=user.role_id  # 👈 AGREGADO
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        log.success(f"✅ Usuario registrado: {new_user.email} con rol {role.nombre}")

        # Notificación en tiempo real
        await ws_manager.broadcast({
            "type": "register",
            "message": "Usuario registrado correctamente",
            "user": new_user.email,
            "role": role.nombre,
            "timestamp": datetime.utcnow().isoformat()
        })

        return build_response(200, "Usuario registrado correctamente", {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": role.nombre
        })
    except Exception as e:
        log.error(f"❌ Error en registro: {e}")
        import traceback
        log.error(traceback.format_exc())
        return build_response(500, "Error interno al registrar usuario")

@app.post("/auth/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Autentica un usuario y devuelve access y refresh tokens.
    Emite una notificación WebSocket al frontend cuando el login es exitoso.
    """
    try:
        # 👇 CORREGIDO: Buscar por username (según UserLogin schema usa username, no email)
        db_user = db.query(User).filter(User.username == user.username).first()
        
        if not db_user:
            log.warning(f"Usuario no encontrado: {user.username}")
            return build_response(404, "Usuario no encontrado")

        if not bcrypt.checkpw(user.password.encode("utf-8"), db_user.password_hash.encode("utf-8")):
            log.warning(f"Contraseña incorrecta para {user.username}")
            return build_response(401, "Contraseña incorrecta")

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

        # 👇 CORREGIDO: Respuesta compatible con Angular (token, role, username)
        return build_response(200, "Login exitoso", {
            "token": access_token,  # Angular espera "token"
            "role": "admin",  # TODO: Ajustar según tu lógica de roles
            "username": db_user.username,
            "refresh_token": refresh_token
        })
    except Exception as e:
        log.error(f"Error en login: {e}")
        import traceback
        log.error(traceback.format_exc())
        return build_response(500, "Error interno en login")

@app.post("/auth/refresh")
def refresh_token(refresh_token: str):
    """Genera un nuevo access token a partir de un refresh token válido."""
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
# Endpoints de Roles
# =========================
@app.post("/roles")
@role_required(["admin"])
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    """Crea un nuevo rol (solo administradores)."""
    db_role = Role(**role.dict())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.get("/roles")
def list_roles(db: Session = Depends(get_db)):
    """Lista todos los roles (accesible públicamente para registro)."""
    try:
        roles = db.query(Role).all()
        return build_response(200, "Roles obtenidos correctamente", [
            {"id": r.id, "nombre": r.nombre, "descripcion": r.descripcion}
            for r in roles
        ])
    except Exception as e:
        log.error(f"Error al listar roles: {e}")
        return build_response(500, "Error al obtener roles")

# =========================
# Endpoints de Productos
# =========================
@app.post("/products")
@role_required(["admin"])
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Crea un nuevo producto (solo administradores)."""
    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/products")
def list_products(db: Session = Depends(get_db)):
    """Lista todos los productos (accesible para todos los usuarios)."""
    return db.query(Product).all()

@app.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Obtiene un producto por su ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product

@app.put("/products/{product_id}")
@role_required(["admin"])
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    """Actualiza un producto (solo administradores)."""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for key, value in product.dict().items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}")
@role_required(["admin"])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Elimina un producto (solo administradores)."""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(db_product)
    db.commit()
    return db_product

# =========================
# Endpoints de Rentas
# =========================
@app.post("/rentals")
@role_required(["client"])
def rent_product(
    rental: RentalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Renta un producto (solo clientes)."""
    product = db.query(Product).filter(Product.id == rental.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    costo_total = product.costo_por_hora * rental.horas_rentadas
    db_rental = Rental(**rental.dict(), user_id=current_user.id, costo_total=costo_total)
    db.add(db_rental)
    db.commit()
    db.refresh(db_rental)
    return db_rental

# =========================
# Endpoints de Estadísticas
# =========================
@app.get("/statistics")
@role_required(["admin"])
def get_statistics(db: Session = Depends(get_db)):
    """Obtiene estadísticas de productos más rentados e ingresos (solo administradores)."""
    # Productos más rentados
    most_rented = db.query(Product, func.count(Rental.id).label('total_rentals')) \
                    .join(Rental) \
                    .group_by(Product.id) \
                    .order_by(desc('total_rentals')) \
                    .limit(5) \
                    .all()
    
    # Ingresos por producto
    income_by_product = db.query(Product, func.sum(Rental.costo_total).label('total_income')) \
                         .join(Rental) \
                         .group_by(Product.id) \
                         .order_by(desc('total_income')) \
                         .all()
    
    return {
        "most_rented": [{"product": p.nombre, "rentals": r} for p, r in most_rented],
        "income_by_product": [{"product": p.nombre, "income": i} for p, i in income_by_product]
    }

# =========================
# CRUD de Usuarios (protegidos)
# =========================
oauth2_scheme = HTTPBearer()

def get_current_user_local(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Obtiene el usuario actual a partir del token JWT."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            log.warning("Token recibido sin 'sub'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado"
            )
    except JWTError as e:
        log.warning(f"Error al decodificar token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        log.warning(f"Token válido pero usuario no encontrado en DB: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

    log.info(f"Usuario autenticado correctamente: {email}")
    return user

@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user_local)):
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
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload-excel")
def upload_excel(file: UploadFile):
    """Sube un archivo Excel y encola la tarea de importación en Celery."""
    try:
        if not file.filename.endswith((".xls", ".xlsx")):
            return build_response(400, "Formato no soportado. Solo XLS/XLSX.")

        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())

        task = process_excel_task.delay(file_path)
        log.info(f"Tarea de importación enviada a Celery, id={task.id}")
        return build_response(202, "Archivo recibido, procesando en segundo plano", {
            "task_id": task.id
        })

    except Exception as e:
        log.error(f"Error en /upload-excel: {e}")
        return build_response(500, "Error interno al subir Excel")

@app.get("/task-status/{task_id}")
def get_task_status(task_id: str):
    """Consulta el estado de la tarea de importación de Excel en Celery."""
    try:
        task = AsyncResult(task_id, app=celery_app)
        
        log.info(f"Consultando tarea {task_id}, estado: {task.state}")
        
        if task.state == "PENDING":
            return build_response(202, "Tarea pendiente", {
                "state": task.state,
                "current": 0,
                "total": 1,
                "percent": 0,
                "status": "Esperando..."
            })
        
        elif task.state == "PROGRESS":
            info = task.info or {}
            current = info.get("current", 0)
            total = info.get("total", 1)
            percent = int((current / total) * 100) if total > 0 else 0
            
            log.info(f"Progreso: {current}/{total} ({percent}%)")
            
            return build_response(202, "Tarea en progreso", {
                "state": task.state,
                "current": current,
                "total": total,
                "percent": percent,
                "status": f"Procesando {current}/{total}..."
            })
        
        elif task.state == "SUCCESS":
            result = task.result or {}
            return build_response(200, "Tarea completada", {
                "state": task.state,
                "current": result.get("rows", 0),
                "total": result.get("rows", 0),
                "percent": 100,
                "status": "Completado!",
                "result": result
            })
        
        elif task.state == "FAILURE":
            return build_response(500, "Tarea fallida", {
                "state": task.state,
                "current": 0,
                "total": 1,
                "percent": 0,
                "status": "Error",
                "error": str(task.info)
            })
        
        else:
            return build_response(202, f"Estado: {task.state}", {
                "state": task.state,
                "current": 0,
                "total": 1,
                "percent": 0,
                "status": task.state
            })
    
    except Exception as e:
        log.error(f"Error al consultar tarea {task_id}: {e}")
        return build_response(500, "Error interno", {
            "state": "ERROR",
            "error": str(e)
        })

@app.get("/test-redis")
def test_redis():
    """Prueba conexión a Redis y lectura de tasks."""
    try:
        import redis
        r = redis.Redis.from_url(REDIS_URL)
        r.ping()
        
        keys = r.keys("celery-task-meta-*")
        
        return build_response(200, "Redis OK", {
            "connected": True,
            "tasks_in_redis": len(keys),
            "sample_keys": [k.decode() for k in keys[:5]]
        })
    except Exception as e:
        return build_response(500, "Redis Error", {"error": str(e)})