import type { SSEHandlerContext } from './sse-event-handlers'
import type { useDashboardChat } from './use-dashboard-chat'
import { getStreamingRefs } from '@/lib/chat-store/store'

type ChatSlice = Pick<
  ReturnType<typeof useDashboardChat>,
  | 'setMessages'
  | 'setIsStreaming'
  | 'setTotalCost'
  | 'setLastStepCost'
  | 'setSessionTodos'
  | 'setFileDiffs'
  | 'setAgentUrl'
  | 'setSessionTitle'
  | 'setSessionInfo'
  | 'setAgentSessionId'
  | 'setStreamStartTime'
  | 'setStreamingStatus'
  | 'streamingStatusStepsRef'
  | 'clearStreamingStatusSteps'
>

/** Build an {@link SSEHandlerContext} from chat state + target session. */
export function createSSEHandlerContext(
  chat: ChatSlice,
  targetSessionId: string,
  accumulateSetupStepsRef: React.MutableRefObject<boolean>,
): SSEHandlerContext {
  const refs = getStreamingRefs(targetSessionId)
  return {
    setMessages: chat.setMessages,
    setIsStreaming: chat.setIsStreaming,
    setTotalCost: chat.setTotalCost,
    setLastStepCost: chat.setLastStepCost,
    setSessionTodos: chat.setSessionTodos,
    setFileDiffs: chat.setFileDiffs,
    setAgentUrl: chat.setAgentUrl,
    setSessionTitle: chat.setSessionTitle,
    setSessionInfo: chat.setSessionInfo,
    setAgentSessionId: chat.setAgentSessionId,
    setStreamStartTime: chat.setStreamStartTime,
    setStreamingStatus: chat.setStreamingStatus,
    accumulateSetupStepsRef,
    streamingStatusStepsRef: chat.streamingStatusStepsRef,
    clearStreamingStatusSteps: chat.clearStreamingStatusSteps,
    streamingMessageRef: refs.streamingMessageRef,
    assistantTextRef: refs.assistantTextRef,
    reasoningRef: refs.reasoningRef,
    targetSessionId,
  }
}
