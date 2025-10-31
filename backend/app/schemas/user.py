from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class RoleBase(BaseModel):
    """Esquema base para roles."""
    nombre: str
    descripcion: Optional[str] = None

class RoleCreate(RoleBase):
    """Esquema para crear un nuevo rol."""
    pass

class Role(RoleBase):
    """Esquema para representar un rol existente."""
    id: int
    fecha_creacion: datetime

    class Config:
        orm_mode = True

class UserBase(BaseModel):
    """Esquema base para usuarios."""
    username: str
    email: EmailStr

class UserCreate(UserBase):
    """Esquema para la creación de un nuevo usuario."""
    password: str
    role_id: int

class UserLogin(BaseModel):
    """Esquema para el inicio de sesión de un usuario."""
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    """Esquema para la actualización parcial de un usuario."""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_id: Optional[int] = None

class User(UserBase):
    """Esquema para representar un usuario existente."""
    id: int
    role: Role
    created_at: datetime

    class Config:
        orm_mode = True

class ProductBase(BaseModel):
    """Esquema base para productos."""
    nombre: str
    descripcion: Optional[str] = None
    costo_por_hora: float

class ProductCreate(ProductBase):
    """Esquema para crear un nuevo producto."""
    pass

class Product(ProductBase):
    """Esquema para representar un producto existente."""
    id: int
    fecha_registro: datetime

    class Config:
        orm_mode = True

# =========================
# Esquemas de Rentas
# =========================

class RentalBase(BaseModel):
    """Esquema base para rentas (datos comunes)."""
    product_id: int
    horas_rentadas: int

class RentalCreate(RentalBase):
    """Esquema para crear una nueva renta (el user_id se toma del token)."""
    pass

class Rental(RentalBase):
    """Esquema para representar una renta existente."""
    id: int
    user_id: int
    costo_total: float
    fecha_renta: datetime

    class Config:
        orm_mode = True
