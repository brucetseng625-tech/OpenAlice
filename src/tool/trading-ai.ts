/**
 * Trading AI Tools — 註冊 Trading AI 能力到 ToolCenter
 *
 * AI 可以：
 * - 跑加密幣或台股回測
 * - 查最後一次回測結果
 * - 查風控狀態
 * - 查權益曲線
 * - 跑即時 5 Blocks 分析（MarketContext）
 * - 查模擬交易狀態
 */

import { tool } from 'ai'
import { z } from 'zod'
import { runBacktest, getTradingAIStatus, getBacktestTrades, getEquityCurve, runPipeline, getPaperTradingStatus, paperTradingTick } from '@/domain/trading-ai/index.js'

export function createTradingAITools() {
  return {
    runTradingAIBacktest: tool({
      description: `Run a backtest using the Trading AI Python engine.
Supports crypto (Binance) and Taiwan stocks (TWSE).
For crypto: symbol like "BTCUSDT", timeframe like "4h", "1h", "15m".
For TWSE: symbol like "2330" (TSMC), daily only.
The backtest uses Wyckoff phase analysis + SMC structure + risk management.
Returns statistics including win rate, PnL, Sharpe ratio, max drawdown.`,
      inputSchema: z.object({
        market: z.enum(['crypto', 'twse']).describe('Market type: crypto or twse'),
      }),
      execute: async ({ market }) => {
        try {
          const result = await runBacktest(market)
          return {
            success: true,
            symbol: result.symbol,
            timeframe: result.timeframe,
            stats: result.stats,
            trade_count: result.trades?.length || 0,
            timestamp: result.timestamp,
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }),

    getBacktestResult: tool({
      description: `Get the latest backtest result from Trading AI.
Returns statistics, trades, and equity curve from the most recent run.`,
      inputSchema: z.object({}),
      execute: async () => {
        const result = await getBacktestTrades()
        if (!result) {
          return { success: false, message: 'No backtest results found' }
        }
        return {
          success: true,
          symbol: result.symbol,
          timeframe: result.timeframe,
          stats: result.stats,
          trades: result.trades,
          timestamp: result.timestamp,
        }
      },
    }),

    getTradingAIStatus: tool({
      description: `Get the current status of the Trading AI system, including configuration, last backtest summary, and risk management state.`,
      inputSchema: z.object({}),
      execute: async () => {
        const status = await getTradingAIStatus()
        const summary = status.last_backtest?.stats || {}
        return {
          available: status.available,
          market_type: status.market_type,
          config: status.config,
          last_backtest: status.last_backtest
            ? {
                symbol: status.last_backtest.symbol,
                timeframe: status.last_backtest.timeframe,
                total_trades: summary.total_trades,
                win_rate: summary.win_rate,
                total_pnl: summary.total_pnl,
                sharpe: summary.sharpe_ratio,
                max_drawdown: summary.max_drawdown,
              }
            : null,
        }
      },
    }),

    getEquityCurve: tool({
      description: `Get the equity curve from the latest Trading AI backtest. Returns an array of equity values over time.`,
      inputSchema: z.object({}),
      execute: async () => {
        const curve = await getEquityCurve()
        return {
          success: curve.length > 0,
          data_points: curve.length,
          curve: curve.slice(-100), // Last 100 points
        }
      },
    }),

    runLiveAnalysis: tool({
      description: `Run the live TradingAI 5 Blocks analysis pipeline.
This runs real-time analysis using current market data:
- Block 1: Sentiment (Fear & Greed, news, on-chain, coin selection)
- Block 2: Technical (Wyckoff phase, SMC structure, indicators)
- Block 3: Decision (Python MathEngine + AI risk auditor)
- Block 4: Verdict (Chinese report)
- Block 5: Execution (simulated order if tradeable)

Returns full MarketContext with entry price, stop loss, take profit targets,
risk/reward ratio, and tradeable verdict. Uses paper trading mode.`,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const ctx = await runPipeline()
          return {
            success: true,
            timestamp: ctx.timestamp,
            best_symbol: ctx.best_symbol,
            direction: ctx.direction,
            confidence: ctx.confidence,
            btc_phase: ctx.btc_phase,
            entry: ctx.entry,
            stop: ctx.stop,
            tp1: ctx.tp1,
            tp2: ctx.tp2,
            rr: ctx.rr,
            is_tradeable: ctx.is_tradeable,
            reject_reason: ctx.reject_reason,
            phi4_verdict: ctx.phi4_verdict,
            order_status: ctx.order_status,
            report_zh: ctx.report_zh?.substring(0, 2000),
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }),

    getPaperTradingStatus: tool({
      description: `Get the current paper trading status from Trading AI.
Returns current balance, open positions, and trade history.`,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const pt = await getPaperTradingStatus()
          return {
            success: true,
            balance: pt.balance,
            open_positions: pt.positions.length,
            positions: pt.positions,
            total_trades: pt.history.length,
            history: pt.history.slice(-10), // Last 10 trades
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }),

    paperTradingTick: tool({
      description: `Run a single paper trading tick. Checks pending orders for fills and manages active positions (stop loss, take profit, trailing stop). Returns any positions that were closed during this tick.`,
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const closed = await paperTradingTick()
          return {
            success: true,
            closed_positions: closed,
            message: closed.length > 0
              ? `${closed.length} position(s) closed`
              : 'No positions closed',
          }
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }),
  }
}
