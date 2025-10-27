from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.user import User
from app.config import SECRET_KEY, ALGORITHM
from app.logger import log

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Obtiene el usuario actual basado en el token JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def role_required(allowed_roles: list):
    """
    Decorador para verificar si el usuario tiene el rol requerido.
    """
    def decorator(func):
        def wrapper(current_user: User = Depends(get_current_user), *args, **kwargs):
            if current_user.role.nombre not in allowed_roles:
                log.warning(f"Acceso denegado para el usuario {current_user.username} con rol {current_user.role.nombre}")
                raise HTTPException(status_code=403, detail="No tienes permiso para realizar esta acción")
            return func(current_user=current_user, *args, **kwargs)
        return wrapper
    return decorator