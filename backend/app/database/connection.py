import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError
from app.config import DATABASE_URL
from app.logger import log

# Crear el engine con reintentos
engine = None
max_retries = 10
wait_seconds = 5

for attempt in range(1, max_retries + 1):
    try:
        engine = create_engine(DATABASE_URL)
        # Probar conexión inmediata
        with engine.connect() as conn:
            log.success("✅ Conexión a MySQL exitosa")
        break
    except OperationalError as e:
        log.warning(f"⏳ Intento {attempt}/{max_retries}: MySQL no está listo ({e})")
        time.sleep(wait_seconds)
else:
    log.error("❌ No se pudo conectar a MySQL después de varios intentos")
    raise

# Sesión de SQLAlchemy
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para los modelos
Base = declarative_base()

# Dependencia para obtener la sesión en los endpoints
def get_db():
    """
    Genera una sesión de base de datos para usar en los endpoints.
    Se asegura de cerrarla correctamente al finalizar.
    """
    db = SessionLocal()
    log.debug("Nueva sesión de base de datos creada")
    try:
        yield db
    except Exception as e:
        log.error(f"Error durante el uso de la sesión de base de datos: {e}")
        raise
    finally:
        db.close()
        log.debug("Sesión de base de datos cerrada")


