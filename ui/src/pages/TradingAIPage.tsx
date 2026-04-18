import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/PageHeader'
import { api } from '../api'
import type { BacktestResult, TradingAIStatus } from '../api/trading-ai'

export function TradingAIPage() {
  const [status, setStatus] = useState<TradingAIStatus | null>(null)
  const [backtest, setBacktest] = useState<BacktestResult | null>(null)
  const [equityCurve, setEquityCurve] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveResult, setLiveResult] = useState<any | null>(null)
  const [paperStatus, setPaperStatus] = useState<any | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, backtestRes, curveRes] = await Promise.all([
        api.tradingAI.getStatus(),
        api.tradingAI.getBacktest(),
        api.tradingAI.getEquityCurve(),
      ])

      if (statusRes.success) {
        const { success, ...rest } = statusRes
        setStatus(rest as unknown as TradingAIStatus)
      }

      if (backtestRes.success) {
        const { success, ...rest } = backtestRes
        setBacktest(rest as unknown as BacktestResult)
      }

      if (curveRes.success) {
        setEquityCurve(curveRes.curve ?? [])
      }
    } catch {
      // API may not be available yet
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const runBacktest = async (market: 'crypto' | 'twse') => {
    setRunning(true)
    setError(null)
    try {
      const result = await api.tradingAI.runBacktest(market)
      if (!result.success) {
        setError(result.error as string || 'Backtest failed')
      } else {
        const { success, ...rest } = result
        setBacktest(rest as unknown as BacktestResult)
        // Refresh status and curve too
        const [statusRes, curveRes] = await Promise.all([
          api.tradingAI.getStatus(),
          api.tradingAI.getEquityCurve(),
        ])
        if (statusRes.success) {
          const { success: _s, ...rest } = statusRes
          setStatus(rest as unknown as TradingAIStatus)
        }
        if (curveRes.success) {
          setEquityCurve(curveRes.curve ?? [])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run backtest')
    } finally {
      setRunning(false)
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    setError(null)
    setLiveResult(null)
    try {
      const result = await api.tradingAI.runPipeline()
      if (!result.success) {
        setError(result.error as string || 'Analysis failed')
      } else {
        const { success, ...rest } = result
        setLiveResult(rest as Record<string, unknown>)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis')
    } finally {
      setAnalyzing(false)
    }
  }

  const loadPaperStatus = async () => {
    try {
      const result = await api.tradingAI.getPaperTrading()
      if (result.success) {
        setPaperStatus(result)
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <PageShell subtitle="Loading..." />
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Trading AI"
        description="Python backtest engine — Wyckoff + SMC strategy"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="btn-primary text-xs"
            >
              {analyzing ? 'Analyzing...' : 'Run Live Analysis'}
            </button>
            <button
              onClick={loadPaperStatus}
              className="btn-secondary text-xs"
            >
              Paper Trading
            </button>
            <button
              onClick={() => runBacktest('crypto')}
              disabled={running}
              className="btn-secondary text-xs"
            >
              {running ? 'Running...' : 'Backtest Crypto'}
            </button>
            <button
              onClick={() => runBacktest('twse')}
              disabled={running}
              className="btn-secondary text-xs"
            >
              {running ? 'Running...' : 'Backtest TWSE'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
        <div className="max-w-[960px] space-y-4">
          {error && (
            <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-3 text-[13px] text-red">
              {error}
            </div>
          )}

          {/* KPI Cards */}
          {backtest && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Total Trades" value={String(backtest.stats.total_trades ?? 0)} />
              <KPICard label="Win Rate" value={`${((backtest.stats.win_rate ?? 0) * 100).toFixed(1)}%`} />
              <KPICard label="Total PnL" value={formatPnL(backtest.stats.total_pnl)} />
              <KPICard label="Sharpe Ratio" value={(backtest.stats.sharpe_ratio ?? 0).toFixed(2)} />
            </div>
          )}

          {/* Live Analysis Result */}
          {liveResult && (
            <div className="rounded-xl border border-border p-4">
              <h3 className="text-[13px] font-semibold text-text mb-3">
                Live Analysis — {liveResult.timestamp as string}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KPICard label="Best Symbol" value={String(liveResult.best_symbol ?? 'N/A')} />
                <KPICard label="Direction" value={String(liveResult.direction ?? 'N/A')} />
                <KPICard label="Confidence" value={String(liveResult.confidence ?? 'N/A')} />
                <KPICard
                  label="Tradeable"
                  value={liveResult.is_tradeable ? 'Yes' : 'No'}
                  highlight={!liveResult.is_tradeable ? 'red' : 'green'}
                />
              </div>
              {liveResult.is_tradeable && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <KPICard label="Entry" value={formatPrice(liveResult.entry)} />
                  <KPICard label="Stop Loss" value={formatPrice(liveResult.stop)} />
                  <KPICard label="TP1" value={formatPrice(liveResult.tp1)} />
                  <KPICard label="TP2" value={formatPrice(liveResult.tp2)} />
                  <KPICard label="R:R" value={String(liveResult.rr ?? 0)} />
                </div>
              )}
              {liveResult.reject_reason && (
                <div className="rounded-lg border border-red/30 bg-red/5 px-4 py-2 text-[12px] text-red">
                  {String(liveResult.reject_reason)}
                </div>
              )}
              {liveResult.report_zh && (
                <div className="rounded-lg border border-border px-4 py-3 text-[12px] text-text whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {String(liveResult.report_zh)}
                </div>
              )}
            </div>
          )}

          {/* Paper Trading Status */}
          {paperStatus && (
            <div className="rounded-xl border border-border p-4">
              <h3 className="text-[13px] font-semibold text-text mb-3">Paper Trading</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <KPICard label="Balance" value={`$${((paperStatus.balance as number) ?? 10000).toFixed(2)}`} />
                <KPICard label="Open Positions" value={String(paperStatus.open_positions ?? 0)} />
                <KPICard label="Total Trades" value={String(paperStatus.total_trades ?? 0)} />
              </div>
              {paperStatus.positions && (paperStatus.positions as Array<Record<string, unknown>>).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border text-text-muted">
                        <th className="text-left px-3 py-1.5 font-medium">Symbol</th>
                        <th className="text-left px-3 py-1.5 font-medium">Side</th>
                        <th className="text-right px-3 py-1.5 font-medium">Entry</th>
                        <th className="text-right px-3 py-1.5 font-medium">Stop</th>
                        <th className="text-right px-3 py-1.5 font-medium">TP1</th>
                        <th className="text-right px-3 py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paperStatus.positions as Array<Record<string, unknown>>).map((pos, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-3 py-1.5 text-text">{pos.symbol as string ?? ''}</td>
                          <td className="px-3 py-1.5">
                            <span className={String(pos.direction).toLowerCase() === 'long' ? 'text-green' : 'text-red'}>
                              {pos.direction as string}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-right text-text">{formatPrice(pos.entry)}</td>
                          <td className="px-3 py-1.5 text-right text-text">{formatPrice(pos.stop)}</td>
                          <td className="px-3 py-1.5 text-right text-text">{formatPrice(pos.tp1)}</td>
                          <td className="px-3 py-1.5 text-right text-text-muted">{pos.status as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {paperStatus.history && (paperStatus.history as Array<Record<string, unknown>>).length > 0 && (
                <div className="mt-3">
                  <h4 className="text-[12px] font-medium text-text mb-2">Recent Trades</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-border text-text-muted">
                          <th className="text-left px-3 py-1.5 font-medium">Symbol</th>
                          <th className="text-left px-3 py-1.5 font-medium">Side</th>
                          <th className="text-right px-3 py-1.5 font-medium">Entry</th>
                          <th className="text-right px-3 py-1.5 font-medium">Exit</th>
                          <th className="text-right px-3 py-1.5 font-medium">PnL</th>
                          <th className="text-left px-3 py-1.5 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paperStatus.history as Array<Record<string, unknown>>).map((t, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="px-3 py-1.5 text-text">{t.symbol as string ?? ''}</td>
                            <td className="px-3 py-1.5">
                              <span className={String(t.direction).toLowerCase() === 'long' ? 'text-green' : 'text-red'}>
                                {t.direction as string}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-text">{formatPrice(t.entry)}</td>
                            <td className="px-3 py-1.5 text-right text-text">{formatPrice(t.exit_price)}</td>
                            <td className={`px-3 py-1.5 text-right font-medium ${((t.pnl as number) ?? 0) >= 0 ? 'text-green' : 'text-red'}`}>
                              {t.pnl != null ? ((t.pnl as number) >= 0 ? '+' : '') : ''}{(t.pnl as number)?.toFixed(2) ?? ''}
                            </td>
                            <td className="px-3 py-1.5 text-text-muted">{t.exit_reason as string ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Info */}
          {status && (
            <div className="rounded-xl border border-border p-4">
              <h3 className="text-[13px] font-semibold text-text mb-2">Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-[12px]">
                <span className="text-text-muted">Market</span>
                <span className="text-text capitalize">{status.market_type ?? 'N/A'}</span>

                <span className="text-text-muted">Initial Balance</span>
                <span className="text-text">${status.config.initial_balance.toLocaleString()}</span>

                <span className="text-text-muted">Capital Ratio</span>
                <span className="text-text">{(status.config.capital_ratio * 100).toFixed(0)}%</span>

                <span className="text-text-muted">Max Loss</span>
                <span className="text-text">{(status.config.max_loss * 100).toFixed(1)}%</span>

                {backtest && (
                  <>
                    <span className="text-text-muted">Symbol</span>
                    <span className="text-text">{backtest.symbol}</span>

                    <span className="text-text-muted">Timeframe</span>
                    <span className="text-text">{backtest.timeframe}</span>

                    <span className="text-text-muted">Max Drawdown</span>
                    <span className="text-red">{((backtest.stats.max_drawdown ?? 0) * 100).toFixed(1)}%</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Equity Curve */}
          {equityCurve.length > 0 && (
            <div className="rounded-xl border border-border p-4">
              <h3 className="text-[13px] font-semibold text-text mb-3">Equity Curve</h3>
              <EquityChart data={equityCurve} />
            </div>
          )}

          {/* Trades Table */}
          {backtest && backtest.trades && backtest.trades.length > 0 && (
            <div className="rounded-xl border border-border">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-semibold text-text">
                  Trades ({backtest.trades.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="text-left px-4 py-2 font-medium">Time</th>
                      <th className="text-left px-4 py-2 font-medium">Side</th>
                      <th className="text-right px-4 py-2 font-medium">Entry</th>
                      <th className="text-right px-4 py-2 font-medium">Exit</th>
                      <th className="text-right px-4 py-2 font-medium">Qty</th>
                      <th className="text-right px-4 py-2 font-medium">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.trades.map((trade, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-bg-tertiary/20">
                        <td className="px-4 py-1.5 text-text-muted">{trade.timestamp ?? ''}</td>
                        <td className="px-4 py-1.5">
                          <span className={trade.side === 'long' || trade.side === 'buy' ? 'text-green' : 'text-red'}>
                            {trade.side ?? ''}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right text-text">{trade.entry_price?.toFixed(2) ?? ''}</td>
                        <td className="px-4 py-1.5 text-right text-text">{trade.exit_price?.toFixed(2) ?? ''}</td>
                        <td className="px-4 py-1.5 text-right text-text">{trade.qty?.toFixed(4) ?? ''}</td>
                        <td className={`px-4 py-1.5 text-right font-medium ${(trade.pnl ?? 0) >= 0 ? 'text-green' : 'text-red'}`}>
                          {trade.pnl != null ? (trade.pnl >= 0 ? '+' : '') : ''}{trade.pnl?.toFixed(2) ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!backtest && !error && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <h3 className="text-[16px] font-semibold text-text mb-2">No backtest data</h3>
              <p className="text-[13px] text-text-muted mb-4 max-w-[320px] mx-auto leading-relaxed">
                Run a backtest to see results here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== KPI Card ====================

function KPICard({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'red' }) {
  const colorClass = highlight === 'green' ? 'text-green' : highlight === 'red' ? 'text-red' : 'text-text'
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-[11px] text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-[20px] font-bold mt-1 ${colorClass}`}>{value}</div>
    </div>
  )
}

// ==================== Equity Chart (SVG sparkline) ====================

function EquityChart({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const width = 800
  const height = 200
  const padding = 10

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const isPositive = data[data.length - 1] >= data[0]
  const color = isPositive ? '#22c55e' : '#ef4444'

  // Area fill
  const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)
  const firstX = padding
  const areaPath = `M${points.join('L')}L${lastX},${height - padding}L${firstX},${height - padding}Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[200px]">
      <defs>
        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#equityGrad)" />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Min/Max labels */}
      <text x={4} y={padding + 4} fill="currentColor" className="text-text-muted" fontSize="11">
        {max.toFixed(0)}
      </text>
      <text x={4} y={height - 4} fill="currentColor" className="text-text-muted" fontSize="11">
        {min.toFixed(0)}
      </text>
    </svg>
  )
}

// ==================== Page Shell ====================

function PageShell({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title="Trading AI" description={subtitle} />
    </div>
  )
}

function formatPnL(value?: number): string {
  if (value == null) return '$0'
  const prefix = value >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(value).toFixed(2)}`
}

function formatPrice(value?: unknown): string {
  if (value == null || value === 'N/A') return 'N/A'
  const n = Number(value)
  return isNaN(n) ? 'N/A' : n.toFixed(2)
}
