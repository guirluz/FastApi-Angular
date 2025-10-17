import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Datos de prueba
test_user = {
    "username": "juan",
    "email": "juan@example.com",
    "password": "j12345"
}

updated_user = {
    "username": "juanito",
    "email": "juanito@example.com",
    "password": "j67890"
}


def test_register_user():
    """Prueba el registro de un nuevo usuario"""
    response = client.post("/auth/register", json=test_user)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == 200
    assert "id" in data["data"]


def test_login_user():
    """Prueba el login del usuario registrado"""
    response = client.post("/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data["data"]
    assert "refresh_token" in data["data"]


def test_create_user_crud():
    """Prueba la creación de usuario vía CRUD (POST /users)"""
    response = client.post("/users", json={
        "username": "maria",
        "email": "maria@example.com",
        "password": "m12345"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == 200
    assert data["data"]["username"] == "maria"


def test_list_users():
    """Prueba listar usuarios"""
    response = client.get("/users")
    assert response.status_code in [200, 404]  # Puede no haber usuarios
    data = response.json()
    assert "status" in data


def test_get_user_by_id():
    """Prueba obtener un usuario existente"""
    # Primero creamos uno
    response = client.post("/users", json={
        "username": "pedro",
        "email": "pedro@example.com",
        "password": "p12345"
    })
    user_id = response.json()["data"]["id"]

    # Ahora lo consultamos
    response = client.get(f"/users/{user_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["id"] == user_id


def test_update_user():
    """Prueba actualizar un usuario existente"""
    # Crear usuario
    response = client.post("/users", json=test_user)
    user_id = response.json()["data"]["id"]

    # Actualizarlo
    response = client.put(f"/users/{user_id}", json=updated_user)
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["username"] == updated_user["username"]


def test_delete_user():
    """Prueba eliminar un usuario existente"""
    # Crear usuario
    response = client.post("/users", json={
        "username": "carlos",
        "email": "carlos@example.com",
        "password": "c12345"
    })
    user_id = response.json()["data"]["id"]

    # Eliminarlo
    response = client.delete(f"/users/{user_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["id"] == user_id
