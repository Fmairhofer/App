import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getHeaders(isJson = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = await AsyncStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Auth
  register: async (email: string, username: string, password: string) => {
    return request('/api/auth/register', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ email, username, password }),
    });
  },

  login: async (email: string, password: string) => {
    return request('/api/auth/login', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ email, password }),
    });
  },

  getMe: async () => {
    return request('/api/auth/me', {
      headers: await getHeaders(),
    });
  },

  // Strategies
  getStrategies: async () => {
    return request('/api/strategies', {
      headers: await getHeaders(),
    });
  },

  uploadStrategy: async (name: string, description: string, code: string, filename: string) => {
    return request('/api/strategies', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, description, code, filename }),
    });
  },

  deleteStrategy: async (id: string) => {
    return request(`/api/strategies/${id}`, {
      method: 'DELETE',
      headers: await getHeaders(),
    });
  },

  // Backtests
  getBacktests: async () => {
    return request('/api/backtests', {
      headers: await getHeaders(),
    });
  },

  getBacktest: async (id: string) => {
    return request(`/api/backtests/${id}`, {
      headers: await getHeaders(),
    });
  },

  createBacktest: async (data: {
    strategy_id: string;
    ticker?: string;
    dataset_id?: string;
    start_date?: string;
    end_date?: string;
    initial_capital: number;
    interval?: string;
  }) => {
    return request('/api/backtests', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
  },

  // Custom data
  getDatasets: async () => {
    return request('/api/data/sets', {
      headers: await getHeaders(),
    });
  },

  uploadDataset: async (name: string, csvContent: string, filename: string) => {
    return request('/api/data/upload', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ name, csv_content: csvContent, filename }),
    });
  },

  // Market data
  getQuote: async (ticker: string) => {
    return request(`/api/market/quote/${ticker}`, {
      headers: await getHeaders(),
    });
  },

  // AI
  aiSuggest: async (prompt: string) => {
    return request('/api/ai/suggest', {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ prompt }),
    });
  },

  aiAnalyze: async (backtestId: string) => {
    return request(`/api/ai/analyze/${backtestId}`, {
      method: 'POST',
      headers: await getHeaders(),
    });
  },
};
