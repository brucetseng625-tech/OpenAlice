/**
 * Trading AI Bridge — 呼叫外部 Trading AI Python 專案
 *
 * 透過 child_process 執行 Trading AI 的回測和訊號產生，
 * 將結果回傳給 OpenAlice 使用。
 *
 * 新增：即時 5 Blocks 分析（--json flag），產生 MarketContext。
 */

import { spawn } from 'child_process'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { writeFileSync } from 'fs'

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

/** MarketContext from TradingAI 5 Blocks pipeline */
export interface MarketContext {
  timestamp?: string
  fg_value?: number
  fg_bias?: string
  fg_signal?: string
  fg_score?: number
  dominance?: number
  best_symbol?: string
  avoid_symbol?: string
  onchain_bias?: string
  news_bias?: string
  btc_price?: number
  btc_phase?: string
  sym_phase?: string
  direction?: string
  confidence?: string
  sym_sup?: number
  sym_res?: number
  bb_upper?: number
  bb_mid?: number
  bb_low?: number
  bb_state?: string
  bb_width?: number
  smc_valid?: boolean
  entry_zone?: string
  stop_zone?: string
  tp1_zone?: string
  tp2_zone?: string
  warning?: string
  entry?: number
  stop?: number
  tp1?: number
  tp2?: number
  rr?: number
  stop_dist?: number
  entry_dist?: number
  max_lev?: number
  market_state?: string
  is_tradeable?: boolean
  reject_reason?: string
  phi4_verdict?: string
  report_zh?: string
  order_id?: string
  order_status?: string
  position_size?: number
  stderr?: string
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

/**
 * Run the live 5 Blocks pipeline (no backtest).
 * Returns the MarketContext JSON output.
 */
export async function runPipeline(): Promise<MarketContext> {
  const stdout = await runPythonScript('main.py', ['--json'])

  // Parse JSON from stdout (after __JSON_RESULT__ marker)
  const marker = '__JSON_RESULT__'
  const idx = stdout.indexOf(marker)
  if (idx === -1) {
    throw new Error(`TradingAI pipeline ran but no JSON output found. Stdout: ${stdout.slice(-500)}`)
  }

  const jsonStr = stdout.slice(idx + marker.length).trim()
  try {
    return JSON.parse(jsonStr) as MarketContext
  } catch {
    throw new Error(`Failed to parse MarketContext JSON: ${jsonStr.slice(0, 500)}`)
  }
}

/**
 * Read the trade_log.json from TradingAI to get current paper trading status.
 */
export async function getPaperTradingStatus(): Promise<{
  balance: number
  positions: Array<Record<string, unknown>>
  history: Array<Record<string, unknown>>
}> {
  const tradeLogPath = resolve(TRADING_AI_ROOT, 'reports', 'trade_log.json')
  try {
    const content = await readFile(tradeLogPath, 'utf-8')
    const trades = JSON.parse(content) as Array<Record<string, unknown>>
    const positions = trades.filter(t => t.status === 'pending' || t.status === 'active')
    const history = trades.filter(t => t.status === 'filled')
    const pnl = history.reduce((sum, t) => sum + ((t.pnl as number) || 0), 0)
    return {
      balance: 10000 + pnl, // INITIAL_BALANCE + realized PnL
      positions,
      history,
    }
  } catch {
    return { balance: 10000, positions: [], history: [] }
  }
}
