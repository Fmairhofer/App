import pytest
import requests

class TestStrategies:
    """Strategy CRUD endpoint tests"""

    def test_get_strategies_authenticated(self, base_url, api_client, auth_headers):
        """Test GET /strategies returns list"""
        response = api_client.get(
            f"{base_url}/api/strategies",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_get_strategies_unauthenticated(self, base_url, api_client):
        """Test GET /strategies without auth returns 401"""
        response = api_client.get(f"{base_url}/api/strategies")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_create_strategy_and_verify(self, base_url, api_client, auth_headers):
        """Test POST /strategies creates and persists strategy"""
        import time
        strategy_name = f"TEST_Strategy_{int(time.time())}"
        
        # Create strategy
        create_response = api_client.post(
            f"{base_url}/api/strategies",
            headers=auth_headers,
            json={
                "name": strategy_name,
                "description": "Test strategy for pytest",
                "code": "def handle_data(context, data):\n    pass",
                "filename": "test_strategy.py"
            }
        )
        
        assert create_response.status_code == 200, f"Expected 200, got {create_response.status_code}: {create_response.text}"
        created = create_response.json()
        assert created["name"] == strategy_name
        assert "id" in created
        strategy_id = created["id"]
        
        # Verify persistence with GET
        get_response = api_client.get(
            f"{base_url}/api/strategies/{strategy_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        retrieved = get_response.json()
        assert retrieved["id"] == strategy_id
        assert retrieved["name"] == strategy_name
        assert retrieved["code"] == "def handle_data(context, data):\n    pass"
        
        # Cleanup
        api_client.delete(f"{base_url}/api/strategies/{strategy_id}", headers=auth_headers)

    def test_delete_strategy(self, base_url, api_client, auth_headers):
        """Test DELETE /strategies/{id} removes strategy"""
        import time
        
        # Create strategy
        create_response = api_client.post(
            f"{base_url}/api/strategies",
            headers=auth_headers,
            json={
                "name": f"TEST_ToDelete_{int(time.time())}",
                "description": "Will be deleted",
                "code": "def handle_data(context, data): pass",
                "filename": "delete_test.py"
            }
        )
        strategy_id = create_response.json()["id"]
        
        # Delete strategy
        delete_response = api_client.delete(
            f"{base_url}/api/strategies/{strategy_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion with GET (should return 404)
        get_response = api_client.get(
            f"{base_url}/api/strategies/{strategy_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 404, f"Expected 404 after deletion, got {get_response.status_code}"

    def test_get_sample_strategies(self, base_url, api_client):
        """Test GET /strategies/samples/list returns seeded samples"""
        response = api_client.get(f"{base_url}/api/strategies/samples/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 3, "Should have at least 3 sample strategies"
        
        # Verify sample strategy structure
        sample = data[0]
        assert "id" in sample
        assert "name" in sample
        assert "code" in sample
        assert "user_id" in sample
        assert sample["user_id"] == "system"

    def test_copy_sample_strategy(self, base_url, api_client, auth_headers):
        """Test POST /strategies/samples/copy/{id} copies sample to user"""
        # Get sample strategies
        samples_response = api_client.get(f"{base_url}/api/strategies/samples/list")
        samples = samples_response.json()
        assert len(samples) > 0, "No sample strategies available"
        
        sample_id = samples[0]["id"]
        
        # Copy sample
        copy_response = api_client.post(
            f"{base_url}/api/strategies/samples/copy/{sample_id}",
            headers=auth_headers
        )
        
        assert copy_response.status_code == 200, f"Expected 200, got {copy_response.status_code}: {copy_response.text}"
        copied = copy_response.json()
        assert copied["name"] == samples[0]["name"]
        assert copied["code"] == samples[0]["code"]
        assert "id" in copied
        assert copied["id"] != sample_id  # Should have new ID
        
        # Cleanup
        api_client.delete(f"{base_url}/api/strategies/{copied['id']}", headers=auth_headers)
