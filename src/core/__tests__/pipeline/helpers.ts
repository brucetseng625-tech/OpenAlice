/**
 * Shared test infrastructure for message pipeline integration tests.
 *
 * FakeProvider, event builders, and helpers used across the pipeline-*.spec.ts
 * files. Session and connector test doubles are imported from their respective
 * modules (MemorySessionStore, MockConnector).
 */

import { AgentCenter } from '../../agent-center.js'
import {
  GenerateRouter,
  StreamableResult,
  type GenerateProvider,
  type ProviderEvent,
  type ProviderResult,
  type GenerateInput,
  type GenerateOpts,
} from '../../ai-provider.js'
import { DEFAULT_COMPACTION_CONFIG } from '../../compaction.js'
import type { ContentBlock } from '../../session.js'
import type { MediaAttachment } from '../../types.js'

// Re-export test doubles for convenience
export { MemorySessionStore } from '../../session.js'
export type { SessionEntry, ContentBlock } from '../../session.js'
export { MockConnector } from '../../../connectors/mock.js'
export type { MockConnectorCall } from '../../../connectors/mock.js'

// ==================== FakeProvider ====================

/** A FakeProvider that yields a configurable sequence of ProviderEvents. */
export class FakeProvider implements GenerateProvider {
  readonly inputKind: 'text' | 'messages'
  readonly providerTag: 'vercel-ai' | 'claude-code' | 'agent-sdk'

  constructor(
    private events: ProviderEvent[],
    opts?: { inputKind?: 'text' | 'messages'; providerTag?: 'vercel-ai' | 'claude-code' | 'agent-sdk' },
  ) {
    this.inputKind = opts?.inputKind ?? 'messages'
    this.providerTag = opts?.providerTag ?? 'vercel-ai'
  }

  async ask(_prompt: string): Promise<ProviderResult> {
    return { text: 'fake-ask', media: [] }
  }

  async *generate(_input: GenerateInput, _opts?: GenerateOpts): AsyncIterable<ProviderEvent> {
    for (const e of this.events) yield e
  }
}

// ==================== Event Builders ====================

export function textEvent(text: string): ProviderEvent {
  return { type: 'text', text }
}

export function toolUseEvent(id: string, name: string, input: unknown): ProviderEvent {
  return { type: 'tool_use', id, name, input }
}

export function toolResultEvent(toolUseId: string, content: string): ProviderEvent {
  return { type: 'tool_result', tool_use_id: toolUseId, content }
}

export function doneEvent(text: string, media: MediaAttachment[] = []): ProviderEvent {
  return { type: 'done', result: { text, media } }
}

// ==================== Helpers ====================

/** Create an AgentCenter wired to a FakeProvider. */
export function makeAgentCenter(provider: FakeProvider): AgentCenter {
  const router = new GenerateRouter(provider, null)
  return new AgentCenter({ router, compaction: DEFAULT_COMPACTION_CONFIG })
}

/** Collect all events from a StreamableResult into an array. */
export async function collectEvents(stream: StreamableResult): Promise<ProviderEvent[]> {
  const events: ProviderEvent[] = []
  for await (const e of stream) events.push(e)
  return events
}
