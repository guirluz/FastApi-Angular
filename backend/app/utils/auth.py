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
    Ahora valida usando el email, ya que en el token se guarda 'sub' = email.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def role_required(allowed_roles: list):
    """
    Dependencia para verificar si el usuario tiene el rol requerido.
    Normaliza el nombre del rol para que sea insensible a mayúsculas/minúsculas
    y mapea valores como 'Administrador' → 'admin', 'Cliente' → 'user'.
    """
    def dependency(current_user: User = Depends(get_current_user)):
        # Normalizar el rol del usuario
        user_role = current_user.role.nombre.lower().strip()

        # Mapeo flexible de roles
        if user_role in ["administrador", "admin"]:
            normalized_role = "admin"
        elif user_role in ["cliente", "user", "usuario"]:
            normalized_role = "user"
        else:
            normalized_role = user_role  # fallback

        # Normalizar también los roles permitidos
        normalized_allowed = [r.lower().strip() for r in allowed_roles]

        if normalized_role not in normalized_allowed:
            log.warning(
                f"Acceso denegado para el usuario {current_user.username} "
                f"con rol {current_user.role.nombre} (normalizado: {normalized_role})"
            )
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para realizar esta acción"
            )

        return current_user  # 👈 se devuelve el usuario autenticado si pasa la validación

    return dependency

