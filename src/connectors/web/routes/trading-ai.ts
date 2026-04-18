/**
 * Trading AI Routes — API endpoints for the Trading AI Python engine.
 *
 * Endpoints:
 *   POST /run-backtest    — trigger a backtest (crypto or twse)
 *   GET  /status          — get Trading AI status + last backtest
 *   GET  /backtest        — get latest backtest trades
 *   GET  /equity-curve    — get equity curve from latest backtest
 *   POST /run-pipeline    — run live 5 Blocks analysis (MarketContext)
 *   GET  /paper-trading   — get paper trading status
 */
import { Hono } from 'hono'
import {
  runBacktest,
  getTradingAIStatus,
  getBacktestTrades,
  getEquityCurve,
  runPipeline,
  getPaperTradingStatus,
  paperTradingTick,
} from '../../../domain/trading-ai/index.js'

export function createTradingAIRoutes() {
  const app = new Hono()

  /** Trigger a backtest */
  app.post('/run-backtest', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}))
      const market = body.market === 'twse' ? 'twse' : 'crypto'
      const result = await runBacktest(market)
      return c.json({ success: true, ...result })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Get Trading AI status */
  app.get('/status', async (c) => {
    try {
      const status = await getTradingAIStatus()
      return c.json({ success: true, ...status })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Get latest backtest trades */
  app.get('/backtest', async (c) => {
    try {
      const result = await getBacktestTrades()
      if (!result) {
        return c.json({ success: false, message: 'No backtest results found' })
      }
      return c.json({ success: true, ...result })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Get equity curve */
  app.get('/equity-curve', async (c) => {
    try {
      const curve = await getEquityCurve()
      return c.json({ success: curve.length > 0, data_points: curve.length, curve: curve.slice(-100) })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Run live 5 Blocks pipeline */
  app.post('/run-pipeline', async (c) => {
    try {
      const result = await runPipeline()
      return c.json({ success: true, ...result })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Get paper trading status */
  app.get('/paper-trading', async (c) => {
    try {
      const pt = await getPaperTradingStatus()
      return c.json({ success: true, ...pt })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  /** Trigger a single paper trading tick */
  app.post('/paper-trading-tick', async (c) => {
    try {
      const closed = await paperTradingTick()
      return c.json({ success: true, closed_positions: closed })
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }, 500)
    }
  })

  return app
}
