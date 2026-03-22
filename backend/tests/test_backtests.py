import pytest
import requests
import time

class TestBacktests:
    """Backtest endpoint tests"""

    @pytest.fixture
    def test_strategy_id(self, base_url, api_client, auth_headers):
        """Create a test strategy and return its ID"""
        response = api_client.post(
            f"{base_url}/api/strategies",
            headers=auth_headers,
            json={
                "name": f"TEST_BacktestStrategy_{int(time.time())}",
                "description": "Simple test strategy",
                "code": """def handle_data(context, data):
    if context.position == 0 and data['close'] > 0:
        context.buy()
    elif context.position > 0 and data.get('index', 0) > 10:
        context.sell()""",
                "filename": "test_backtest.py"
            }
        )
        strategy_id = response.json()["id"]
        yield strategy_id
        # Cleanup
        api_client.delete(f"{base_url}/api/strategies/{strategy_id}", headers=auth_headers)

    def test_get_backtests_authenticated(self, base_url, api_client, auth_headers):
        """Test GET /backtests returns list"""
        response = api_client.get(
            f"{base_url}/api/backtests",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_create_backtest_yahoo_data(self, base_url, api_client, auth_headers, test_strategy_id):
        """Test POST /backtests with Yahoo Finance data"""
        response = api_client.post(
            f"{base_url}/api/backtests",
            headers=auth_headers,
            json={
                "strategy_id": test_strategy_id,
                "ticker": "AAPL",
                "start_date": "2024-01-01",
                "end_date": "2024-06-01",
                "initial_capital": 10000.0,
                "interval": "1d"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify backtest structure
        assert "id" in data
        assert data["strategy_id"] == test_strategy_id
        assert data["ticker"] == "AAPL"
        assert data["initial_capital"] == 10000.0
        assert data["status"] == "completed"
        assert "metrics" in data
        assert "equity_curve" in data
        assert "trades" in data
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "total_return" in metrics
        assert "final_value" in metrics
        assert "sharpe_ratio" in metrics
        assert "max_drawdown" in metrics
        assert "win_rate" in metrics
        assert "total_trades" in metrics
        
        backtest_id = data["id"]
        
        # Verify persistence with GET
        get_response = api_client.get(
            f"{base_url}/api/backtests/{backtest_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        retrieved = get_response.json()
        assert retrieved["id"] == backtest_id
        assert retrieved["strategy_id"] == test_strategy_id
        assert "equity_curve" in retrieved
        assert "trades" in retrieved

    def test_create_backtest_invalid_strategy(self, base_url, api_client, auth_headers):
        """Test POST /backtests with non-existent strategy returns 404"""
        response = api_client.post(
            f"{base_url}/api/backtests",
            headers=auth_headers,
            json={
                "strategy_id": "nonexistent-strategy-id",
                "ticker": "AAPL",
                "initial_capital": 10000.0
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    def test_get_backtest_by_id(self, base_url, api_client, auth_headers, test_strategy_id):
        """Test GET /backtests/{id} returns full backtest data"""
        # Create backtest first
        create_response = api_client.post(
            f"{base_url}/api/backtests",
            headers=auth_headers,
            json={
                "strategy_id": test_strategy_id,
                "ticker": "MSFT",
                "start_date": "2024-01-01",
                "end_date": "2024-03-01",
                "initial_capital": 5000.0
            }
        )
        backtest_id = create_response.json()["id"]
        
        # Get backtest
        response = api_client.get(
            f"{base_url}/api/backtests/{backtest_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == backtest_id
        assert "equity_curve" in data
        assert "trades" in data
        assert isinstance(data["equity_curve"], list)
        assert isinstance(data["trades"], list)

    def test_get_backtest_not_found(self, base_url, api_client, auth_headers):
        """Test GET /backtests/{id} with invalid ID returns 404"""
        response = api_client.get(
            f"{base_url}/api/backtests/nonexistent-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
