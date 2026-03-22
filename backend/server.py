from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import pandas as pd
import numpy as np
import yfinance as yf
import io
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

executor = ThreadPoolExecutor(max_workers=4)

app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== MODELS =====

class RegisterInput(BaseModel):
    email: str
    username: str
    password: str

class LoginInput(BaseModel):
    email: str
    password: str

class StrategyInput(BaseModel):
    name: str
    description: str = ""
    code: str
    filename: str = "strategy.py"

class BacktestInput(BaseModel):
    strategy_id: str
    ticker: Optional[str] = "AAPL"
    dataset_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    initial_capital: float = 10000.0
    interval: str = "1d"

class DataUploadInput(BaseModel):
    name: str
    csv_content: str
    filename: str = "data.csv"

class AiPromptInput(BaseModel):
    prompt: str

# ===== AUTH HELPERS =====

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

from fastapi import Header

async def auth_dependency(authorization: str = Header(None)):
    return await get_current_user(authorization)

# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/register")
async def register(input: RegisterInput):
    existing = await db.users.find_one({"email": input.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": input.email,
        "username": input.username,
        "password_hash": hash_password(input.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user_id)
    return {
        "token": token,
        "user": {"id": user_id, "email": input.email, "username": input.username}
    }

@api_router.post("/auth/login")
async def login(input: LoginInput):
    user = await db.users.find_one({"email": input.email})
    if not user or not verify_password(input.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "username": user["username"]}
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(auth_dependency)):
    return {"id": user["id"], "email": user["email"], "username": user["username"]}

# ===== STRATEGY ENDPOINTS =====

@api_router.get("/strategies")
async def list_strategies(user=Depends(auth_dependency)):
    strategies = await db.strategies.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return strategies

@api_router.post("/strategies")
async def create_strategy(input: StrategyInput, user=Depends(auth_dependency)):
    strategy = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": input.name,
        "description": input.description,
        "code": input.code,
        "filename": input.filename,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.strategies.insert_one(strategy)
    return {k: v for k, v in strategy.items() if k != "_id"}

@api_router.get("/strategies/{strategy_id}")
async def get_strategy(strategy_id: str, user=Depends(auth_dependency)):
    strategy = await db.strategies.find_one(
        {"id": strategy_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy

@api_router.delete("/strategies/{strategy_id}")
async def delete_strategy(strategy_id: str, user=Depends(auth_dependency)):
    result = await db.strategies.delete_one({"id": strategy_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"message": "Strategy deleted"}

# ===== CUSTOM DATA ENDPOINTS =====

@api_router.get("/data/sets")
async def list_datasets(user=Depends(auth_dependency)):
    datasets = await db.custom_datasets.find(
        {"user_id": user["id"]}, {"_id": 0, "data": 0}
    ).sort("created_at", -1).to_list(100)
    return datasets

@api_router.post("/data/upload")
async def upload_dataset(input: DataUploadInput, user=Depends(auth_dependency)):
    try:
        df = pd.read_csv(io.StringIO(input.csv_content))
        required_cols = {'close'}
        cols_lower = {c.lower() for c in df.columns}
        if not required_cols.issubset(cols_lower):
            raise HTTPException(status_code=400, detail="CSV must have at least a 'close' column")
        col_map = {c: c.lower() for c in df.columns}
        df = df.rename(columns=col_map)
        records = df.to_dict(orient='records')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    dataset = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": input.name,
        "filename": input.filename,
        "row_count": len(records),
        "columns": list(df.columns),
        "data": records,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_datasets.insert_one(dataset)
    return {k: v for k, v in dataset.items() if k not in ("_id", "data")}

# ===== MARKET DATA =====

def fetch_yahoo_data(ticker: str, start: str = None, end: str = None, period: str = "1y", interval: str = "1d"):
    try:
        t = yf.Ticker(ticker)
        kwargs = {"interval": interval, "auto_adjust": True}
        if start and end:
            kwargs["start"] = start
            kwargs["end"] = end
        else:
            kwargs["period"] = period
        data = t.history(**kwargs)
        if data.empty:
            return None
        return data
    except Exception as e:
        logger.error(f"Yahoo Finance error: {e}")
        return None

@api_router.get("/market/quote/{ticker}")
async def get_quote(ticker: str, user=Depends(auth_dependency)):
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(executor, fetch_yahoo_data, ticker, None, None, "5d", "1d")
    if data is None or data.empty:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")
    latest = data.iloc[-1]
    prev = data.iloc[-2] if len(data) > 1 else latest
    change = float(latest.get("Close", 0)) - float(prev.get("Close", 0))
    change_pct = (change / float(prev.get("Close", 1))) * 100
    return {
        "ticker": ticker,
        "close": round(float(latest.get("Close", 0)), 2),
        "open": round(float(latest.get("Open", 0)), 2),
        "high": round(float(latest.get("High", 0)), 2),
        "low": round(float(latest.get("Low", 0)), 2),
        "volume": int(latest.get("Volume", 0)),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
    }

# ===== BACKTEST ENGINE =====

class BacktestContext:
    def __init__(self, initial_capital):
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.position = 0
        self.portfolio_value = initial_capital
        self.trades = []
        self.equity_curve = []
        self._current_price = 0
        self._current_date = ""
        self._current_idx = 0

    def buy(self, shares=None):
        if self.cash <= 0 or self._current_price <= 0:
            return
        if shares is None:
            shares = int(self.cash / self._current_price)
        if shares <= 0:
            return
        cost = shares * self._current_price
        if cost > self.cash:
            shares = int(self.cash / self._current_price)
            cost = shares * self._current_price
        if shares <= 0:
            return
        self.cash -= cost
        self.position += shares
        self.trades.append({
            "date": self._current_date,
            "type": "BUY",
            "price": round(self._current_price, 2),
            "shares": shares,
            "value": round(cost, 2)
        })

    def sell(self, shares=None):
        if self.position <= 0:
            return
        if shares is None:
            shares = self.position
        if shares > self.position:
            shares = self.position
        revenue = shares * self._current_price
        self.cash += revenue
        self.position -= shares
        self.trades.append({
            "date": self._current_date,
            "type": "SELL",
            "price": round(self._current_price, 2),
            "shares": shares,
            "value": round(revenue, 2)
        })

def compute_indicators(df):
    close = df['close'].astype(float)
    for p in [5, 10, 20, 50]:
        df[f'sma_{p}'] = close.rolling(window=p).mean()
    for p in [12, 26]:
        df[f'ema_{p}'] = close.ewm(span=p, adjust=False).mean()
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['rsi_14'] = 100 - (100 / (1 + rs))
    df['rsi_14'] = df['rsi_14'].fillna(50)
    return df

def run_backtest_engine(strategy_code: str, data_records: list, initial_capital: float):
    df = pd.DataFrame(data_records)
    col_map = {}
    for c in df.columns:
        cl = c.lower()
        if cl in ('open', 'high', 'low', 'close', 'volume', 'date'):
            col_map[c] = cl
    df = df.rename(columns=col_map)

    if 'close' not in df.columns:
        raise ValueError("Data must have a 'close' column")

    for col in ['open', 'high', 'low', 'volume']:
        if col not in df.columns:
            if col == 'volume':
                df[col] = 0
            else:
                df[col] = df['close']

    if 'date' not in df.columns:
        df['date'] = [f"Day {i+1}" for i in range(len(df))]

    df = df.ffill().bfill()
    df = compute_indicators(df)

    ctx = BacktestContext(initial_capital)

    safe_builtins = {
        'abs': abs, 'bool': bool, 'dict': dict, 'float': float,
        'int': int, 'len': len, 'list': list, 'max': max, 'min': min,
        'range': range, 'round': round, 'str': str, 'sum': sum,
        'True': True, 'False': False, 'None': None, 'print': lambda *a: None,
    }

    namespace = {'__builtins__': safe_builtins}
    try:
        exec(strategy_code, namespace)
    except Exception as e:
        raise ValueError(f"Strategy code error: {str(e)}")

    init_fn = namespace.get('init')
    handle_data_fn = namespace.get('handle_data')
    if not handle_data_fn:
        raise ValueError("Strategy must define a 'handle_data(context, data)' function")

    if init_fn:
        try:
            init_fn(ctx)
        except Exception as e:
            raise ValueError(f"Error in init(): {str(e)}")

    for idx in range(len(df)):
        row = df.iloc[idx]
        ctx._current_price = float(row['close'])
        ctx._current_date = str(row['date'])
        ctx._current_idx = idx
        ctx.portfolio_value = ctx.cash + ctx.position * ctx._current_price

        data_point = {
            'open': float(row.get('open', 0)),
            'high': float(row.get('high', 0)),
            'low': float(row.get('low', 0)),
            'close': float(row['close']),
            'volume': float(row.get('volume', 0)),
            'date': str(row['date']),
            'index': idx,
        }
        for col in df.columns:
            if col.startswith(('sma_', 'ema_', 'rsi_')):
                val = row[col]
                data_point[col] = float(val) if pd.notna(val) else None

        try:
            handle_data_fn(ctx, data_point)
        except Exception as e:
            logger.warning(f"Strategy error at bar {idx}: {e}")

        ctx.portfolio_value = ctx.cash + ctx.position * ctx._current_price
        ctx.equity_curve.append({
            "date": str(row['date']),
            "value": round(ctx.portfolio_value, 2)
        })

    metrics = calculate_metrics(ctx, initial_capital)
    return {
        "metrics": metrics,
        "equity_curve": ctx.equity_curve,
        "trades": ctx.trades,
    }

def calculate_metrics(ctx: BacktestContext, initial_capital: float):
    final_value = ctx.portfolio_value
    total_return = ((final_value - initial_capital) / initial_capital) * 100

    equity_values = [e["value"] for e in ctx.equity_curve]
    if len(equity_values) < 2:
        return {
            "total_return": round(total_return, 2),
            "final_value": round(final_value, 2),
            "total_trades": len(ctx.trades),
            "win_rate": 0, "max_drawdown": 0,
            "sharpe_ratio": 0, "sortino_ratio": 0,
            "winning_trades": 0, "losing_trades": 0,
            "avg_win": 0, "avg_loss": 0, "profit_factor": 0,
        }

    peak = equity_values[0]
    max_dd = 0
    for v in equity_values:
        if v > peak:
            peak = v
        dd = (peak - v) / peak * 100
        if dd > max_dd:
            max_dd = dd

    returns = []
    for i in range(1, len(equity_values)):
        if equity_values[i-1] > 0:
            r = (equity_values[i] - equity_values[i-1]) / equity_values[i-1]
            returns.append(r)

    avg_return = np.mean(returns) if returns else 0
    std_return = np.std(returns) if returns else 1
    sharpe = (avg_return / std_return * np.sqrt(252)) if std_return > 0 else 0

    negative_returns = [r for r in returns if r < 0]
    downside_std = np.std(negative_returns) if negative_returns else 1
    sortino = (avg_return / downside_std * np.sqrt(252)) if downside_std > 0 else 0

    wins = 0
    losses = 0
    win_amounts = []
    loss_amounts = []

    buy_stack = []
    for t in ctx.trades:
        if t["type"] == "BUY":
            buy_stack.append(t)
        elif t["type"] == "SELL" and buy_stack:
            buy_t = buy_stack.pop(0)
            pnl = (t["price"] - buy_t["price"]) * t["shares"]
            if pnl > 0:
                wins += 1
                win_amounts.append(pnl)
            else:
                losses += 1
                loss_amounts.append(abs(pnl))

    total_pairs = wins + losses
    win_rate = (wins / total_pairs * 100) if total_pairs > 0 else 0
    avg_win = np.mean(win_amounts) if win_amounts else 0
    avg_loss = np.mean(loss_amounts) if loss_amounts else 0
    total_loss = sum(loss_amounts)
    profit_factor = (sum(win_amounts) / total_loss) if total_loss > 0 else float('inf') if win_amounts else 0

    n_days = len(equity_values)
    years = n_days / 252 if n_days > 0 else 1
    ann_return = ((final_value / initial_capital) ** (1/years) - 1) * 100 if years > 0 and initial_capital > 0 else 0

    return {
        "total_return": round(total_return, 2),
        "annualized_return": round(ann_return, 2),
        "final_value": round(final_value, 2),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": len(ctx.trades),
        "winning_trades": wins,
        "losing_trades": losses,
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
        "profit_factor": round(profit_factor, 2) if profit_factor != float('inf') else 999.99,
    }

# ===== BACKTEST ENDPOINTS =====

@api_router.post("/backtests")
async def create_backtest(input: BacktestInput, user=Depends(auth_dependency)):
    strategy = await db.strategies.find_one(
        {"id": input.strategy_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    if input.dataset_id:
        dataset = await db.custom_datasets.find_one(
            {"id": input.dataset_id, "user_id": user["id"]}, {"_id": 0}
        )
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        data_records = dataset["data"]
        data_source = f"Custom: {dataset['name']}"
    else:
        ticker = input.ticker or "AAPL"
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(
            executor, fetch_yahoo_data, ticker,
            input.start_date, input.end_date, "1y", input.interval
        )
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail=f"No data available for {ticker}")
        df = df.reset_index()
        df.columns = [c.lower() if isinstance(c, str) else str(c).lower() for c in df.columns]
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        elif 'datetime' in df.columns:
            df['date'] = df['datetime'].astype(str)
        else:
            df['date'] = [str(i) for i in range(len(df))]
        data_records = df.to_dict(orient='records')
        data_source = f"Yahoo: {ticker}"

    try:
        result = await loop.run_in_executor(
            executor, run_backtest_engine, strategy["code"], data_records, input.initial_capital
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Backtest error: {e}")
        raise HTTPException(status_code=500, detail=f"Backtest execution failed: {str(e)}")

    # Downsample equity curve for storage
    eq_curve = result["equity_curve"]
    if len(eq_curve) > 200:
        step = len(eq_curve) // 200
        eq_curve = eq_curve[::step]

    backtest = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "strategy_id": strategy["id"],
        "strategy_name": strategy["name"],
        "data_source": data_source,
        "ticker": input.ticker or "AAPL",
        "start_date": input.start_date,
        "end_date": input.end_date,
        "initial_capital": input.initial_capital,
        "interval": input.interval,
        "status": "completed",
        "metrics": result["metrics"],
        "equity_curve": eq_curve,
        "trades": result["trades"][:500],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.backtests.insert_one(backtest)
    return {k: v for k, v in backtest.items() if k != "_id"}

@api_router.get("/backtests")
async def list_backtests(user=Depends(auth_dependency)):
    backtests = await db.backtests.find(
        {"user_id": user["id"]},
        {"_id": 0, "equity_curve": 0, "trades": 0}
    ).sort("created_at", -1).to_list(100)
    return backtests

@api_router.get("/backtests/{backtest_id}")
async def get_backtest(backtest_id: str, user=Depends(auth_dependency)):
    backtest = await db.backtests.find_one(
        {"id": backtest_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not backtest:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return backtest

# ===== AI ENDPOINTS =====

@api_router.post("/ai/suggest")
async def ai_suggest_strategy(input: AiPromptInput, user=Depends(auth_dependency)):
    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    system_message = """You are an expert quantitative trading strategy developer. 
When asked to create a trading strategy, generate Python code that follows this interface:

def init(context):
    # Initialize strategy parameters (optional)
    # e.g., context.sma_period = 20
    pass

def handle_data(context, data):
    # Called for each bar of data
    # data contains: open, high, low, close, volume, date, index
    # Also: sma_5, sma_10, sma_20, sma_50, ema_12, ema_26, rsi_14
    # context.buy(shares=None) - buy shares (None = all cash)
    # context.sell(shares=None) - sell shares (None = all held)
    # context.position - current shares held
    # context.cash - current cash
    # context.portfolio_value - total portfolio value
    pass

Always provide complete, working Python code with comments explaining the logic.
Only use the available indicators: sma_5, sma_10, sma_20, sma_50, ema_12, ema_26, rsi_14.
Keep strategies simple and practical."""
    completion = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": input.prompt},
        ],
    )
    response = completion.choices[0].message.content
    return {"response": response, "type": "suggestion"}

@api_router.post("/ai/analyze/{backtest_id}")
async def ai_analyze_backtest(backtest_id: str, user=Depends(auth_dependency)):
    backtest = await db.backtests.find_one(
        {"id": backtest_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not backtest:
        raise HTTPException(status_code=404, detail="Backtest not found")

    strategy = await db.strategies.find_one(
        {"id": backtest["strategy_id"]}, {"_id": 0}
    )
    strategy_code = strategy["code"] if strategy else "Unknown"

    metrics = backtest.get("metrics", {})

    from openai import AsyncOpenAI
    openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    system_message = """You are an expert trading analyst. Analyze backtest results and provide:
1. Performance summary
2. Strengths and weaknesses
3. Risk assessment  
4. Specific improvement suggestions
5. Market condition suitability
Be concise but insightful. Use data to support your analysis."""

    prompt = f"""Analyze this backtest result:

Strategy: {backtest.get('strategy_name', 'Unknown')}
Data Source: {backtest.get('data_source', 'Unknown')}
Initial Capital: ${backtest.get('initial_capital', 0):,.2f}

Metrics:
- Total Return: {metrics.get('total_return', 0)}%
- Annualized Return: {metrics.get('annualized_return', 0)}%
- Final Value: ${metrics.get('final_value', 0):,.2f}
- Max Drawdown: {metrics.get('max_drawdown', 0)}%
- Sharpe Ratio: {metrics.get('sharpe_ratio', 0)}
- Sortino Ratio: {metrics.get('sortino_ratio', 0)}
- Win Rate: {metrics.get('win_rate', 0)}%
- Total Trades: {metrics.get('total_trades', 0)}
- Winning Trades: {metrics.get('winning_trades', 0)}
- Losing Trades: {metrics.get('losing_trades', 0)}
- Avg Win: ${metrics.get('avg_win', 0):,.2f}
- Avg Loss: ${metrics.get('avg_loss', 0):,.2f}
- Profit Factor: {metrics.get('profit_factor', 0)}

Strategy Code:
{strategy_code}"""

    completion = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt},
        ],
    )
    response = completion.choices[0].message.content
    return {"response": response, "type": "analysis", "backtest_id": backtest_id}

# ===== SEED DATA =====

SAMPLE_STRATEGIES = [
    {
        "name": "SMA Crossover",
        "description": "Buy when SMA 10 crosses above SMA 50, sell when it crosses below",
        "code": """def init(context):
    context.prev_sma_10 = None
    context.prev_sma_50 = None

def handle_data(context, data):
    sma_10 = data.get('sma_10')
    sma_50 = data.get('sma_50')
    
    if sma_10 is None or sma_50 is None:
        return
    
    if context.prev_sma_10 is not None and context.prev_sma_50 is not None:
        # Golden cross: SMA 10 crosses above SMA 50
        if context.prev_sma_10 <= context.prev_sma_50 and sma_10 > sma_50:
            if context.position == 0:
                context.buy()
        # Death cross: SMA 10 crosses below SMA 50
        elif context.prev_sma_10 >= context.prev_sma_50 and sma_10 < sma_50:
            if context.position > 0:
                context.sell()
    
    context.prev_sma_10 = sma_10
    context.prev_sma_50 = sma_50
""",
        "filename": "sma_crossover.py"
    },
    {
        "name": "RSI Strategy",
        "description": "Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)",
        "code": """def init(context):
    context.rsi_buy = 30
    context.rsi_sell = 70

def handle_data(context, data):
    rsi = data.get('rsi_14')
    if rsi is None:
        return
    
    if rsi < context.rsi_buy and context.position == 0:
        context.buy()
    elif rsi > context.rsi_sell and context.position > 0:
        context.sell()
""",
        "filename": "rsi_strategy.py"
    },
    {
        "name": "Mean Reversion",
        "description": "Buy when price drops 2% below SMA 20, sell when it returns above",
        "code": """def init(context):
    context.threshold = 0.02

def handle_data(context, data):
    sma_20 = data.get('sma_20')
    close = data['close']
    
    if sma_20 is None or sma_20 == 0:
        return
    
    deviation = (close - sma_20) / sma_20
    
    if deviation < -context.threshold and context.position == 0:
        context.buy()
    elif deviation > 0 and context.position > 0:
        context.sell()
""",
        "filename": "mean_reversion.py"
    }
]

@app.on_event("startup")
async def seed_data():
    count = await db.strategies.count_documents({"user_id": "system"})
    if count == 0:
        for s in SAMPLE_STRATEGIES:
            strategy = {
                "id": str(uuid.uuid4()),
                "user_id": "system",
                "name": s["name"],
                "description": s["description"],
                "code": s["code"],
                "filename": s["filename"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.strategies.insert_one(strategy)
        logger.info("Seeded sample strategies")

# Endpoint to get sample strategies (available to all users)
@api_router.get("/strategies/samples/list")
async def list_sample_strategies():
    strategies = await db.strategies.find(
        {"user_id": "system"}, {"_id": 0}
    ).to_list(20)
    return strategies

@api_router.post("/strategies/samples/copy/{strategy_id}")
async def copy_sample_strategy(strategy_id: str, user=Depends(auth_dependency)):
    sample = await db.strategies.find_one({"id": strategy_id, "user_id": "system"}, {"_id": 0})
    if not sample:
        raise HTTPException(status_code=404, detail="Sample strategy not found")
    new_strategy = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": sample["name"],
        "description": sample["description"],
        "code": sample["code"],
        "filename": sample["filename"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.strategies.insert_one(new_strategy)
    return {k: v for k, v in new_strategy.items() if k != "_id"}

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
