import { fetchJson } from './client'

export interface BacktestStats {
  total_trades?: number
  win_rate?: number
  total_pnl?: number
  sharpe_ratio?: number
  max_drawdown?: number
  [key: string]: unknown
}

export interface BacktestTrade {
  timestamp?: string
  side?: string
  entry_price?: number
  exit_price?: number
  qty?: number
  pnl?: number
  [key: string]: unknown
}

export interface BacktestResult {
  symbol: string
  timeframe: string
  stats: BacktestStats
  trades?: BacktestTrade[]
  timestamp: string
}

export interface TradingAIStatus {
  available: boolean
  root: string
  market_type: 'crypto' | 'twse' | null
  last_backtest: BacktestResult | null
  config: {
    initial_balance: number
    capital_ratio: number
    max_loss: number
  }
}

export const tradingAIApi = {
  async runBacktest(market: 'crypto' | 'twse' = 'crypto'): Promise<Record<string, unknown>> {
    const res = await fetch('/api/trading-ai/run-backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market }),
    })
    return res.json()
  },

  async getStatus(): Promise<Record<string, unknown>> {
    return fetchJson('/api/trading-ai/status')
  },

  async getBacktest(): Promise<Record<string, unknown>> {
    return fetchJson('/api/trading-ai/backtest')
  },

  async getEquityCurve(): Promise<{ success: boolean; data_points: number; curve: number[] }> {
    return fetchJson('/api/trading-ai/equity-curve')
  },

  async runPipeline(): Promise<Record<string, unknown>> {
    const res = await fetch('/api/trading-ai/run-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return res.json()
  },

  async getPaperTrading(): Promise<Record<string, unknown>> {
    return fetchJson('/api/trading-ai/paper-trading')
  },
}
