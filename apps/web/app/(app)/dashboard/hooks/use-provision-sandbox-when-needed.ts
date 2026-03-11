'use client'

import { useEffect, useRef } from 'react'
import { useSandboxStatus, useProvisionSandbox } from '@/lib/api/hooks/use-sessions'

/**
 * When opening a session that has no sandbox (error or never provisioned),
 * automatically call POST /sandbox to provision.
 */
export function useProvisionSandboxWhenNeeded(sessionId: string | null) {
  const { sandbox, mutate } = useSandboxStatus(sessionId ?? undefined)
  const { provisionSandbox } = useProvisionSandbox()
  const provisionedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!sessionId || !sandbox) return
    if (provisionedRef.current.has(sessionId)) return

    const needsProvision =
      sandbox.status === 'error' ||
      (!sandbox.sandboxId && sandbox.status !== 'provisioning' && sandbox.status !== 'resuming')

    if (needsProvision) {
      provisionedRef.current.add(sessionId)
      provisionSandbox({ sessionId })
        .then(() => mutate())
        .catch(() => {
          provisionedRef.current.delete(sessionId)
        })
    }
  }, [sessionId, sandbox, provisionSandbox, mutate])
}
