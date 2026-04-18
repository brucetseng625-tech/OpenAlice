import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfigPage } from '../hooks/useConfigPage'
import { SaveIndicator } from '../components/SaveIndicator'
import { SDKSelector, CONNECTOR_OPTIONS } from '../components/SDKSelector'
import { ConfigSection, Field, inputClass } from '../components/form'
import { PageHeader } from '../components/PageHeader'
import type { AppConfig, ConnectorsConfig } from '../api'

export function ConnectorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingChatId, setPendingChatId] = useState<number | null>(null)

  const { config, status, loadError, updateConfig, updateConfigImmediate, retry } =
    useConfigPage<ConnectorsConfig>({
      section: 'connectors',
      extract: (full: AppConfig) => full.connectors,
    })

  // Pick up ?addChatId= from URL
  useEffect(() => {
    const raw = searchParams.get('addChatId')
    if (!raw) return
    const id = Number(raw)
    if (!isNaN(id) && id !== 0) setPendingChatId(id)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const handleAuthorize = () => {
    if (!config || !pendingChatId) return
    if (!config.telegram.chatIds.includes(pendingChatId)) {
      updateConfigImmediate({
        telegram: { ...config.telegram, chatIds: [...config.telegram.chatIds, pendingChatId] },
      })
    }
    setPendingChatId(null)
  }

  // Derive selected connector IDs from enabled flags (web + mcp are always included)
  const selected = config
    ? [
        'web',
        'mcp',
        ...(config.mcpAsk.enabled ? ['mcpAsk'] : []),
        ...(config.telegram.enabled ? ['telegram'] : []),
      ]
    : ['web', 'mcp']

  const handleToggle = (id: string) => {
    if (!config) return
    if (id === 'mcpAsk') {
      updateConfigImmediate({ mcpAsk: { ...config.mcpAsk, enabled: !config.mcpAsk.enabled } })
    } else if (id === 'telegram') {
      updateConfigImmediate({ telegram: { ...config.telegram, enabled: !config.telegram.enabled } })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="連接器"
        description="服務端口與外部整合。變更需要重新啟動。"
        right={<SaveIndicator status={status} onRetry={retry} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {config && (
          <div className="max-w-[880px] mx-auto">
            {/* Telegram chat authorization banner */}
            {pendingChatId !== null && (
              <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-[13px]">
                <span>
                  授權 Telegram 聊天 <code className="font-mono font-semibold">{pendingChatId}</code>？
                </span>
                <span className="flex gap-2 shrink-0">
                  <button
                    className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-500"
                    onClick={handleAuthorize}
                  >
                    授權
                  </button>
                  <button
                    className="rounded-md border border-border px-3 py-1 hover:bg-bg-2"
                    onClick={() => setPendingChatId(null)}
                  >
                    略過
                  </button>
                </span>
              </div>
            )}
            {/* Connector selector cards */}
            <ConfigSection
              title="啟用的連接器"
              description="選擇要啟用的連接器。Web UI 與 MCP 伺服器始終啟用。"
            >
              <SDKSelector
                options={CONNECTOR_OPTIONS}
                selected={selected}
                onToggle={handleToggle}
              />
            </ConfigSection>

            {/* Web UI config — always shown */}
            <ConfigSection
              title="Web UI"
              description="瀏覽器聊天與設定介面。"
            >
              <Field label="Port">
                <input
                  className={inputClass}
                  type="number"
                  value={config.web.port}
                  onChange={(e) => updateConfig({ web: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Server config — always shown */}
            <ConfigSection
              title="MCP Server"
              description="Claude Code 供應商與外部 AI 代理的工具橋接。"
            >
              <Field label="Port">
                <input
                  className={inputClass}
                  type="number"
                  value={config.mcp.port}
                  onChange={(e) => updateConfig({ mcp: { port: Number(e.target.value) } })}
                />
              </Field>
            </ConfigSection>

            {/* MCP Ask config */}
            {config.mcpAsk.enabled && (
              <ConfigSection
                title="MCP 問答"
                description="外部代理的多輪對話端點。"
              >
                <Field label="Port">
                  <input
                    className={inputClass}
                    type="number"
                    value={config.mcpAsk.port ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      updateConfig({ mcpAsk: { ...config.mcpAsk, port: v ? Number(v) : undefined } })
                    }}
                    placeholder="e.g. 3003"
                  />
                </Field>
              </ConfigSection>
            )}

            {/* Telegram config */}
            {config.telegram.enabled && (
              <ConfigSection
                title="Telegram"
                description="透過 @BotFather 建立機器人，貼上 Token，並加入你的 Chat ID。"
              >
                <Field label="Bot Token">
                  <input
                    className={inputClass}
                    type="password"
                    value={config.telegram.botToken ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botToken: e.target.value || undefined },
                      })
                    }
                    placeholder="123456:ABC-DEF..."
                  />
                </Field>
                <Field label="Bot Username">
                  <input
                    className={inputClass}
                    value={config.telegram.botUsername ?? ''}
                    onChange={(e) =>
                      updateConfig({
                        telegram: { ...config.telegram, botUsername: e.target.value || undefined },
                      })
                    }
                    placeholder="my_bot"
                  />
                </Field>
                <Field label="允許的 Chat IDs">
                  <input
                    className={inputClass}
                    value={config.telegram.chatIds.join(', ')}
                    onChange={(e) =>
                      updateConfig({
                        telegram: {
                          ...config.telegram,
                          chatIds: e.target.value
                            ? e.target.value
                                .split(',')
                                .map((s) => Number(s.trim()))
                                .filter((n) => !isNaN(n))
                            : [],
                        },
                      })
                    }
                    placeholder="Comma-separated, e.g. 123456, 789012"
                  />
                </Field>
              </ConfigSection>
            )}
          </div>
        )}
        {loadError && <p className="text-[13px] text-red">無法載入設定。</p>}
      </div>
    </div>
  )
}
