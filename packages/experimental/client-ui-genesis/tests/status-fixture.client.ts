/** Deterministic data fixture for read-only rendering and resource tests. */
import { brandString } from '@deepseek-ai/dsh-brand'
import type { LifeStatus } from '@deepseek-ai/dsh-experimental-genesis/types'

export function statusFixture(): LifeStatus {
  return {
    identity: { id: brandString<LifeStatus['identity']['id']>('72f7e6b7-5490-4d61-8da8-9ce536d632c0'), name: null,
      createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z', lifeCoreVersion: '0.1.0-alpha.1',
      origin: { framework: 'DeepSeek Harness', initialVersion: '0.1.0-alpha.1' } },
    sampledAt: '2026-10-23T00:00:01.000Z', runtime: { platform: 'linux', node: '24', liveSessions: 0 },
    counts: { events: 3, memories: 1, growth: 1 }, capabilities: [], memories: [], growth: [],
    omitted: { capabilities: 0, memories: 1, growth: 1 },
  }
}
