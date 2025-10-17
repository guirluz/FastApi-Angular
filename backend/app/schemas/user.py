from typing import Optional
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    """
    Esquema para la creación de un nuevo usuario.
    Se utiliza en el endpoint de registro (/auth/register).
    """
    username: str   # Nombre de usuario
    email: EmailStr # Correo electrónico válido
    password: str   # Contraseña en texto plano (se encripta antes de guardar)


class UserLogin(BaseModel):
    """
    Esquema para el inicio de sesión de un usuario.
    Se utiliza en el endpoint de login (/auth/login).
    """
    email: EmailStr # Correo electrónico válido
    password: str   # Contraseña en texto plano (se valida contra el hash en DB)


class UserUpdate(BaseModel):
    """
    Esquema para la actualización parcial de un usuario.
    Permite modificar username, email y/o password de forma opcional.
    """
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

