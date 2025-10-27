from sqlalchemy import Column, Integer, String, TIMESTAMP, func, ForeignKey
from sqlalchemy.orm import relationship
from app.database.connection import Base
from app.logger import log

class Role(Base):
    """
    Modelo de la tabla 'roles'.
    Representa los roles disponibles en el sistema.
    """
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    descripcion = Column(String(255))
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    # Relación con la tabla users
    users = relationship("User", back_populates="role")

class User(Base):
    """
    Modelo de la tabla 'users'.
    Representa a los usuarios registrados en el sistema.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Nueva columna para la relación con roles
    role_id = Column(Integer, ForeignKey('roles.id'))
    role = relationship("Role", back_populates="users")

    def __repr__(self):
        """
        Representación en string del objeto User, útil para depuración.
        """
        log.debug(f"Instancia de User creada: id={self.id}, email={self.email}, role_id={self.role_id}")
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}', role_id={self.role_id})>"

# Crear un nuevo archivo para el modelo Product
class Product(Base):
    """
    Modelo de la tabla 'products'.
    Representa los productos disponibles para renta.
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(255))
    costo_por_hora = Column(Integer, nullable=False)
    fecha_registro = Column(TIMESTAMP, server_default=func.now())

    # Relación con la tabla rentals
    rentals = relationship("Rental", back_populates="product")

class Rental(Base):
    """
    Modelo de la tabla 'rentals'.
    Representa las operaciones de renta de productos.
    """
    __tablename__ = "rentals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    product_id = Column(Integer, ForeignKey('products.id'))
    horas_rentadas = Column(Integer, nullable=False)
    costo_total = Column(Integer, nullable=False)
    fecha_renta = Column(TIMESTAMP, server_default=func.now())

    # Relaciones
    user = relationship("User", back_populates="rentals")
    product = relationship("Product", back_populates="rentals")

# Añadir relación de User con Rental
User.rentals = relationship("Rental", back_populates="user")
