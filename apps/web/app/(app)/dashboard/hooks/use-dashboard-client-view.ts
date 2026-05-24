'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@ship/ui'
import { setApiToken } from '@/lib/api/client'
import { useAgentDefaultModel } from '@/lib/api/hooks/use-models'
import type { ChatSession } from '@/lib/api/server'
import type { User } from '@/lib/api/types'
import type { UIMessage } from '@/lib/ai-elements-adapter'
import { useDashboardDerived } from './use-dashboard-derived'
import { useRightSidebar } from './use-right-sidebar'
import {
  useDashboardModelSelect,
  useDashboardPromptHandlers,
  buildRightSidebarData,
} from './dashboard-client-helpers'
import { useDashboardSessionSync } from './use-dashboard-session-sync'
import { useActiveSessionSync } from './use-dashboard-client-effects'
import { useDashboardClientCore, useDashboardClientRefs } from './use-dashboard-client-core'
import { useHomepageComposerDefaults } from './use-homepage-composer-defaults'

export interface DashboardClientViewParams {
  sessions: ChatSession[]
  user: User
  initialSessionId?: string | null
  initialMessages?: UIMessage[]
  initialApiMessages?: Array<{ id: string; role: string; content: string; createdAt: number; parts?: string }>
  serverTimestamp?: number
  apiToken?: string
}

export { useDashboardClientRefs }

export function useDashboardClientView({
  sessions: initialSessions,
  user,
  initialSessionId = null,
  initialMessages,
  initialApiMessages,
  serverTimestamp = Math.floor(Date.now() / 1000),
  apiToken,
}: DashboardClientViewParams) {
  if (apiToken) setApiToken(apiToken)

  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const refs = useDashboardClientRefs()

  const { chat, state, dataHooks, handleSend, streamingSessionIds } = useDashboardClientCore(
    initialSessions,
    initialSessionId,
    initialMessages,
    initialApiMessages,
    user,
    refs,
  )

  const {
    defaultModelId: agentDefaultModelId,
    isLoading: agentDefaultModelLoading,
    mutate: mutateAgentDefaultModel,
  } = useAgentDefaultModel(state.selectedAgent?.id, true)
  const defaultModelId = agentDefaultModelId || dataHooks.globalDefaultModelId
  const defaultModelLoading = dataHooks.globalDefaultModelLoading || agentDefaultModelLoading

  const { handleRepoSelect, handleAgentSelectWithPersist, persistDefaultModel } = useHomepageComposerDefaults({
    activeSessionId: chat.activeSessionId,
    selectedAgentId: state.selectedAgent?.id,
    setSelectedRepo: state.setSelectedRepo,
    handleAgentSelect: state.handleAgentSelect,
    mutateDefaultRepo: dataHooks.mutateDefaultRepo,
    mutateDefaultAgent: dataHooks.mutateDefaultAgent,
    mutateAgentDefaultModel,
  })

  const handleModelSelect = useDashboardModelSelect(chat, state, dataHooks, {
    agents: dataHooks.agents,
    persistDefaultModel,
  })

  const derived = useDashboardDerived({
    chat,
    state,
    data: dataHooks.derivedData,
    isCreating: dataHooks.isCreating,
    onRepoSelect: handleRepoSelect,
    onAgentSelect: handleAgentSelectWithPersist,
    onModelSelect: handleModelSelect,
  })

  useDashboardSessionSync({
    initialSessionId,
    sessionParam: searchParams.get('session'),
    handleSend,
    chat,
    state,
    dataHooks,
    defaultModelId: defaultModelId ?? null,
    defaultModelLoading,
  })

  const rightSidebar = useRightSidebar()
  const { activeSession, activeSessionAgent, activeSessionModel } = useActiveSessionSync(
    chat,
    {
      selectedAgent: state.selectedAgent,
      selectedModel: state.selectedModel,
      handleAgentSelect: state.handleAgentSelect,
      setSelectedModel: state.setSelectedModel,
    },
    dataHooks.agents,
    dataHooks.models,
    dataHooks.sessionModelId,
  )

  const promptHandlers = useDashboardPromptHandlers(chat)
  const handleRetryLastMessage = useCallback(() => {
    const lastUserMsg = [...chat.messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg?.content) handleSend(lastUserMsg.content)
  }, [chat.messages, handleSend])

  const rightSidebarData = buildRightSidebarData(chat, state, activeSession, activeSessionAgent, activeSessionModel)

  return {
    user,
    serverTimestamp,
    isMobile,
    chat,
    state,
    derived,
    dataHooks,
    streamingSessionIds,
    rightSidebar,
    rightSidebarData,
    promptHandlers,
    handleRetryLastMessage,
  }
}
