import pytest
import requests
import os

@pytest.fixture(scope="session")
def base_url():
    """Get base URL from environment"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        pytest.fail("EXPO_PUBLIC_BACKEND_URL not set in environment")
    return url.rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def test_user_credentials():
    """Test user credentials"""
    return {
        "email": "TEST_newtest@test.com",
        "username": "TEST_newtest",
        "password": "testpass123"
    }

@pytest.fixture(scope="session")
def auth_token(base_url, api_client, test_user_credentials):
    """Create test user and return auth token"""
    # Try to register new user
    try:
        response = api_client.post(
            f"{base_url}/api/auth/register",
            json=test_user_credentials
        )
        if response.status_code == 200:
            return response.json()["token"]
        elif response.status_code == 400 and "already registered" in response.text:
            # User exists, try login
            login_response = api_client.post(
                f"{base_url}/api/auth/login",
                json={
                    "email": test_user_credentials["email"],
                    "password": test_user_credentials["password"]
                }
            )
            if login_response.status_code == 200:
                return login_response.json()["token"]
    except Exception as e:
        pytest.skip(f"Failed to authenticate test user: {e}")
    
    pytest.skip("Could not create or login test user")

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }
