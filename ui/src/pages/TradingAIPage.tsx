import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/PageHeader'
import { api } from '../api'
import type { BacktestResult, TradingAIStatus } from '../api/trading-ai'

export function TradingAIPage() {
  const [status, setStatus] = useState<TradingAIStatus | null>(null)
  const [backtest, setBacktest] = useState<BacktestResult | null>(null)
  const [equityCurve, setEquityCurve] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
              onClick={() => runBacktest('crypto')}
              disabled={running}
              className="btn-primary text-xs"
            >
              {running ? 'Running...' : 'Run Crypto Backtest'}
            </button>
            <button
              onClick={() => runBacktest('twse')}
              disabled={running}
              className="btn-secondary text-xs"
            >
              {running ? 'Running...' : 'Run TWSE Backtest'}
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

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-[11px] text-text-muted uppercase tracking-wide">{label}</div>
      <div className="text-[20px] font-bold text-text mt-1">{value}</div>
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
