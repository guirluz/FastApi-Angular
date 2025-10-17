from sqlalchemy import Column, Integer, String, TIMESTAMP, func
from app.database.connection import Base
from app.logger import log  # 👈 Importamos logger solo si queremos depuración

class User(Base):
    """
    Modelo de la tabla 'users'.
    Representa a los usuarios registrados en el sistema.
    """
    __tablename__ = "users"

    # Identificador único del usuario
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Nombre de usuario
    username = Column(String(50), nullable=False)

    # Correo electrónico único
    email = Column(String(100), unique=True, nullable=False)

    # Hash de la contraseña (no se guarda la contraseña en texto plano)
    password_hash = Column(String(255), nullable=False)

    # Fecha de creación del registro
    created_at = Column(TIMESTAMP, server_default=func.now())

    def __repr__(self):
        """
        Representación en string del objeto User, útil para depuración.
        """
        log.debug(f"Instancia de User creada: id={self.id}, email={self.email}")
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"