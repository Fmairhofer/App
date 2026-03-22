import pytest
import requests
import time

class TestAI:
    """AI endpoint tests"""

    def test_ai_suggest_strategy(self, base_url, api_client, auth_headers):
        """Test POST /ai/suggest returns strategy suggestion"""
        response = api_client.post(
            f"{base_url}/api/ai/suggest",
            headers=auth_headers,
            json={
                "prompt": "Create a simple moving average crossover strategy"
            },
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "response" in data, "Response should contain 'response' field"
        assert "type" in data
        assert data["type"] == "suggestion"
        assert len(data["response"]) > 0, "AI response should not be empty"

    def test_ai_analyze_backtest(self, base_url, api_client, auth_headers):
        """Test POST /ai/analyze/{backtest_id} returns analysis"""
        # First create a strategy
        strategy_response = api_client.post(
            f"{base_url}/api/strategies",
            headers=auth_headers,
            json={
                "name": f"TEST_AIAnalysis_{int(time.time())}",
                "description": "Test strategy for AI analysis",
                "code": """def handle_data(context, data):
    if context.position == 0:
        context.buy()
    elif data.get('index', 0) > 5:
        context.sell()""",
                "filename": "ai_test.py"
            }
        )
        strategy_id = strategy_response.json()["id"]
        
        # Create backtest
        backtest_response = api_client.post(
            f"{base_url}/api/backtests",
            headers=auth_headers,
            json={
                "strategy_id": strategy_id,
                "ticker": "AAPL",
                "start_date": "2024-01-01",
                "end_date": "2024-02-01",
                "initial_capital": 10000.0
            }
        )
        backtest_id = backtest_response.json()["id"]
        
        # Analyze backtest
        response = api_client.post(
            f"{base_url}/api/ai/analyze/{backtest_id}",
            headers=auth_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "response" in data
        assert "type" in data
        assert data["type"] == "analysis"
        assert "backtest_id" in data
        assert data["backtest_id"] == backtest_id
        assert len(data["response"]) > 0
        
        # Cleanup
        api_client.delete(f"{base_url}/api/strategies/{strategy_id}", headers=auth_headers)

    def test_ai_analyze_nonexistent_backtest(self, base_url, api_client, auth_headers):
        """Test POST /ai/analyze/{backtest_id} with invalid ID returns 404"""
        response = api_client.post(
            f"{base_url}/api/ai/analyze/nonexistent-backtest-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
