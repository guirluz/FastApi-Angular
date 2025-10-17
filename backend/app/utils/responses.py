from fastapi.responses import JSONResponse

def build_response(status_code: int, message: str, data: dict = None):
    """
    Construye una respuesta JSON uniforme para todos los endpoints.
    """
    payload = {
        "status": status_code,
        "message": message,
        "data": data
    }
    return JSONResponse(status_code=status_code, content=payload)
