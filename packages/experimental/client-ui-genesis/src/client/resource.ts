/** On-demand status resource; shared resource machinery owns data and stale-value retention. @module */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { LifeStatus } from '@deepseek-ai/dsh-experimental-genesis/types'

/** Coalesces user refreshes without polling, duplicating data or creating a scheduler. */
export class StatusResource {
  private readonly listeners = new Set<() => void>()

  /** Request a fresh sample from every currently held status resource. */
  refresh(): void { for (const notify of this.listeners) notify() }

  /**
   * Read an initial sample and then only on explicit refresh or reconnection.
   * @param read - Authenticated generated RPC with caller cancellation.
   * @param signal - Resource lifetime; abort ends waits and cancels in-flight RPC.
   * @returns Result frames for the shared resource owner.
   */
  async *open(
    read: (signal: AbortSignal) => Promise<RemoteResult<LifeStatus>>, signal: AbortSignal,
  ): AsyncIterable<RemoteResult<LifeStatus>> {
    const aborted = () => signal.aborted
    let pending = true
    let wake: (() => void) | undefined
    const notify = () => { pending = true; wake?.() }
    const abort = () => { wake?.() }
    this.listeners.add(notify)
    signal.addEventListener('abort', abort, { once: true })
    try {
      while (!aborted()) {
        if (!pending) await new Promise<void>((resolve) => { wake = resolve })
        wake = undefined
        if (aborted()) break
        pending = false
        const frame = await read(signal)
        if (aborted()) break
        yield frame
      }
    } finally {
      this.listeners.delete(notify)
      signal.removeEventListener('abort', abort)
    }
  }
}
