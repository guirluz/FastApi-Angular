from loguru import logger
import sys

# Configuración básica de Loguru
logger.remove()  # elimina handlers por defecto
logger.add(sys.stdout, colorize=True, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | <cyan>{message}</cyan>")
logger.add("logs/app.log", rotation="1 MB", retention="7 days", level="INFO")

# Exportar logger para usar en todo el proyecto
log = logger
