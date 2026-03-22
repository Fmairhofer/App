import pytest
import requests

class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self, base_url, api_client):
        """Test user registration with unique email"""
        import time
        unique_email = f"TEST_user_{int(time.time())}@test.com"
        
        response = api_client.post(
            f"{base_url}/api/auth/register",
            json={
                "email": unique_email,
                "username": f"testuser_{int(time.time())}",
                "password": "testpass123"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["email"] == unique_email
        assert "id" in data["user"]
        assert "username" in data["user"]

    def test_register_duplicate_email(self, base_url, api_client, test_user_credentials):
        """Test registration with existing email returns 400"""
        response = api_client.post(
            f"{base_url}/api/auth/register",
            json=test_user_credentials
        )
        
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()

    def test_login_success(self, base_url, api_client, test_user_credentials):
        """Test successful login"""
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={
                "email": test_user_credentials["email"],
                "password": test_user_credentials["password"]
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_user_credentials["email"]

    def test_login_invalid_credentials(self, base_url, api_client):
        """Test login with invalid credentials"""
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_get_me_authenticated(self, base_url, api_client, auth_headers):
        """Test /auth/me with valid token"""
        response = api_client.get(
            f"{base_url}/api/auth/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "username" in data

    def test_get_me_unauthenticated(self, base_url, api_client):
        """Test /auth/me without token returns 401"""
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
