import { describe, expect, it } from 'vitest'

import { createSessionStatusStore } from './use-session-status-store'

function waitForNotifyFlush() {
  return new Promise<void>((resolve) => queueMicrotask(resolve))
}

describe('session status store', () => {
  it('does not notify listeners added during the current flush', async () => {
    const store = createSessionStatusStore()
    let firstCalls = 0
    let secondCalls = 0
    let unsubscribeFirst = () => {}

    unsubscribeFirst = store.subscribe(() => {
      firstCalls += 1
      unsubscribeFirst()
      store.subscribe(() => {
        secondCalls += 1
      })
    })

    store.update('session-1', { isRunning: true, status: 'Preparing...' })
    await waitForNotifyFlush()

    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(0)

    store.update('session-1', { status: 'Running' })
    await waitForNotifyFlush()

    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
  })

  it('does not notify subscribers for equivalent updates', async () => {
    const store = createSessionStatusStore()
    let calls = 0
    store.subscribe(() => {
      calls += 1
    })

    store.update('session-1', { isRunning: true, status: 'Preparing...', steps: [] })
    await waitForNotifyFlush()
    store.update('session-1', { isRunning: true, status: 'Preparing...', steps: [] })
    await waitForNotifyFlush()

    expect(calls).toBe(1)
  })
})
