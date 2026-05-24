import type { SSEHandlerContext } from './sse-event-handlers'
import type { useDashboardChat } from './use-dashboard-chat'

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
  | 'streamingMessageRef'
  | 'assistantTextRef'
  | 'reasoningRef'
>

/** Build an {@link SSEHandlerContext} from chat state + target session. */
export function createSSEHandlerContext(
  chat: ChatSlice,
  targetSessionId: string,
  accumulateSetupStepsRef: React.MutableRefObject<boolean>,
): SSEHandlerContext {
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
    streamingMessageRef: chat.streamingMessageRef,
    assistantTextRef: chat.assistantTextRef,
    reasoningRef: chat.reasoningRef,
    targetSessionId,
  }
}
