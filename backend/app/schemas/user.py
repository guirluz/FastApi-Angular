# backend/app/schemas/user.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    """Schema para crear un nuevo usuario"""
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    """Schema para login de usuario"""
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    """Schema para actualizar usuario (campos opcionales)"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    """Schema para respuesta de usuario (sin password)"""
    id: int
    username: str
    email: str
    role: str
    
    class Config:
        from_attributes = True