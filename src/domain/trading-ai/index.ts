/**
 * Trading AI Bridge — 呼叫外部 Trading AI Python 專案
 *
 * 透過 child_process 執行 Trading AI 的回測和訊號產生，
 * 將結果回傳給 OpenAlice 使用。
 */

import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'

const TRADING_AI_ROOT = resolve(process.cwd(), '..', 'TradingAI')

export interface BacktestResult {
  symbol: string
  timeframe: string
  stats: Record<string, unknown>
  trades: Array<Record<string, unknown>>
  timestamp: string
}

export interface SignalResult {
  timestamp: string
  best_symbol?: string
  direction?: string
  confidence?: string
  entry?: number
  stop?: number
  tp1?: number
  rr?: number
  is_tradeable: boolean
  reject_reason?: string
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

async function runPythonScript(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [script, ...args], {
      cwd: TRADING_AI_ROOT,
      timeout: 300_000, // 5 minutes
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      reject(new Error(`Trading AI process error: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Trading AI exited with code ${code}: ${stderr.slice(-500)}`))
      }
    })
  })
}

async function readBacktestResult(file: string): Promise<BacktestResult | null> {
  try {
    const content = await readFile(resolve(TRADING_AI_ROOT, 'reports', file), 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(resolve(TRADING_AI_ROOT, 'config.py'), 'utf-8')
    const result: Record<string, unknown> = {}
    const balanceMatch = content.match(/INITIAL_BALANCE\s*=\s*([\d.]+)/)
    const capitalMatch = content.match(/CAPITAL_RATIO\s*=\s*([\d.]+)/)
    const lossMatch = content.match(/MAX_LOSS_RATIO\s*=\s*([\d.]+)/)
    const marketMatch = content.match(/MARKET_TYPE\s*=\s*"(\w+)"/)

    if (balanceMatch) result.initial_balance = parseFloat(balanceMatch[1])
    if (capitalMatch) result.capital_ratio = parseFloat(capitalMatch[1])
    if (lossMatch) result.max_loss = parseFloat(lossMatch[1])
    if (marketMatch) result.market_type = marketMatch[1]

    return result
  } catch {
    return {}
  }
}

export async function runBacktest(market: 'crypto' | 'twse' = 'crypto'): Promise<BacktestResult> {
  const flag = market === 'twse' ? '--backtest-twse' : '--backtest'
  await runPythonScript('main.py', [flag])
  const result = await readBacktestResult('backtest_trades.json')
  if (!result) {
    throw new Error('Backtest completed but result file not found')
  }
  return result as BacktestResult
}

export async function getTradingAIStatus(): Promise<TradingAIStatus> {
  const config = await readConfig()
  const lastBacktest = await readBacktestResult('backtest_trades.json')

  return {
    available: true,
    root: TRADING_AI_ROOT,
    market_type: (config.market_type as 'crypto' | 'twse') || null,
    last_backtest: lastBacktest,
    config: {
      initial_balance: (config.initial_balance as number) || 10000,
      capital_ratio: (config.capital_ratio as number) || 0.2,
      max_loss: (config.max_loss as number) || 0.02,
    },
  }
}

export async function getBacktestTrades(market: 'crypto' | 'twse' = 'crypto'): Promise<BacktestResult | null> {
  // For simplicity, read the latest backtest file
  // In a real scenario, we'd run the backtest or read the most recent one
  return readBacktestResult('backtest_trades.json')
}

export async function getEquityCurve(): Promise<number[]> {
  const result = await readBacktestResult('backtest_trades.json')
  return result?.equity_curve as number[] || []
}
