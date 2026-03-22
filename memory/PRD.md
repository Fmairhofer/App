# QuantLab - Stock Trading Strategy Backtester

## Product Overview
QuantLab is a mobile app for backtesting stock trading strategies. Users can upload their own Python strategy files, use Yahoo Finance data or custom CSV datasets, and get AI-powered analysis of results.

## Core Features
- **JWT Authentication**: Secure user registration and login
- **Strategy Management**: Upload .py strategy files, use 3 pre-built sample strategies (SMA Crossover, RSI, Mean Reversion), copy samples to personal library
- **Backtest Engine**: Execute Python strategies against historical stock data with 12+ metrics
- **Data Sources**: Yahoo Finance (real-time) + custom CSV data upload
- **Metrics**: Total Return, Annualized Return, Sharpe Ratio, Sortino Ratio, Max Drawdown, Win Rate, Profit Factor, trade-by-trade log, equity curve
- **AI Integration**: GPT-5.2 via Emergent LLM key for strategy suggestions and backtest analysis
- **Dark/Light Theme**: Toggle with AsyncStorage persistence

## Tech Stack
- **Frontend**: Expo (React Native) with Expo Router, react-native-gifted-charts
- **Backend**: FastAPI (Python) with MongoDB (Motor)
- **AI**: OpenAI GPT-5.2 via emergentintegrations
- **Data**: yfinance for Yahoo Finance, pandas for data processing

## Strategy Interface
```python
def init(context):
    # Initialize strategy parameters
    pass

def handle_data(context, data):
    # data: open, high, low, close, volume, date, sma_5/10/20/50, ema_12/26, rsi_14
    # context.buy(shares=None), context.sell(shares=None)
    # context.position, context.cash, context.portfolio_value
    pass
```

## API Endpoints
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `GET/POST /api/strategies` - Strategy CRUD
- `GET/POST /api/backtests` - Backtest management
- `POST /api/data/upload` - CSV data upload
- `GET /api/market/quote/{ticker}` - Stock quote
- `POST /api/ai/suggest` - AI strategy suggestions
- `POST /api/ai/analyze/{id}` - AI backtest analysis

## Screens
1. Login / Register (JWT auth)
2. Dashboard (stats, recent backtests, quick actions)
3. Strategies (my strategies, samples, upload .py)
4. New Backtest (select strategy, configure params, run)
5. Backtest Results (metrics grid, equity curve chart, trade log)
6. AI Assistant (chat for strategy suggestions)
7. Settings (theme toggle, profile, logout)
