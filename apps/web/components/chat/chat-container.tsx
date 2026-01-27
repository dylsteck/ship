"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { useState, useCallback, useEffect, useRef } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";

interface ChatContainerProps {
  sessionId: Id<"sessions">;
  initialPrompt?: string;
  onInitialPromptSent?: () => void;
}

export function ChatContainer({ sessionId, initialPrompt, onInitialPromptSent }: ChatContainerProps) {
  const session = useQuery(api.sessions.get, { id: sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);

  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<Array<{ id: string; name: string; arguments: Record<string, unknown> }>>([]);
  const [streamingToolResults, setStreamingToolResults] = useState<Array<{ toolCallId: string; result: unknown }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const initialPromptSentRef = useRef(false);

  const handleSend = useCallback(
    async (content: string) => {
      if (!session) return;

      setIsLoading(true);
      setStreamingContent("");
      setStreamingToolCalls([]);
      setStreamingToolResults([]);
      setIsThinking(false);

      try {
        // Save user message to Convex
        await sendMessage({ sessionId, content });

        // Send to API and stream response
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/sessions/${sessionId}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";
        const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
        const toolResults: Array<{ toolCallId: string; result: unknown }> = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setIsThinking(false);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "text") {
                  accumulated += parsed.data;
                  setStreamingContent(accumulated);
                  setIsThinking(false);
                } else if (parsed.type === "tool_call") {
                  setIsThinking(true);
                  const toolCall = parsed.data as { id: string; name: string; arguments: Record<string, unknown> };
                  toolCalls.push(toolCall);
                  setStreamingToolCalls([...toolCalls]);
                } else if (parsed.type === "tool_result") {
                  const toolResult = parsed.data as { toolCallId: string; result: unknown };
                  toolResults.push(toolResult);
                  setStreamingToolResults([...toolResults]);
                  // Keep thinking indicator until we get text or done
                } else if (parsed.type === "done") {
                  setIsThinking(false);
                } else if (parsed.type === "error") {
                  setIsThinking(false);
                  console.error("Stream error:", parsed.data);
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setIsThinking(false);
      } finally {
        setIsLoading(false);
        setStreamingContent("");
        setStreamingToolCalls([]);
        setStreamingToolResults([]);
        setIsThinking(false);
      }
    },
    [session, sessionId, sendMessage]
  );

  // Send initial prompt when session becomes ready
  useEffect(() => {
    if (
      initialPrompt &&
      !initialPromptSentRef.current &&
      session?.status === "running" &&
      messages &&
      messages.length === 0
    ) {
      initialPromptSentRef.current = true;
      handleSend(initialPrompt);
      onInitialPromptSent?.();
    }
  }, [initialPrompt, session?.status, messages, handleSend, onInitialPromptSent]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const isRunning = session.status === "running";
  const isStarting = session.status === "starting";
  const isIdle = session.status === "idle";
  const isError = session.status === "error";
  const isStopped = session.status === "stopped";

  return (
    <div className="flex flex-col h-full">
      {/* Status Banner */}
      {isStarting && (
        <div className="bg-muted/50 border-b border-border px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary" />
            <span className="text-xs text-muted-foreground">
              Starting sandbox... This may take a moment while we clone your repo and set up the environment.
            </span>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-destructive">
              <span className="font-medium">Error:</span> {session.errorMessage || "Failed to start session"}
            </p>
          </div>
        </div>
      )}

      {isStopped && (
        <div className="bg-muted/50 border-b border-border px-4 py-2">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs text-muted-foreground">Session stopped</p>
          </div>
        </div>
      )}

      {/* Thinking indicator */}
      {(isThinking || (isLoading && streamingToolCalls.length > 0)) && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span>Agent is thinking and working...</span>
            {streamingToolCalls.length > 0 && (
              <span className="text-[10px] opacity-70">
                ({streamingToolCalls.length} {streamingToolCalls.length === 1 ? "action" : "actions"})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={(messages || []) as any}
        streamingContent={isLoading ? streamingContent : undefined}
        streamingToolCalls={isLoading && streamingToolCalls.length > 0 ? streamingToolCalls : undefined}
        streamingToolResults={isLoading && streamingToolResults.length > 0 ? streamingToolResults : undefined}
      />

      {/* Input - always show but disable when not ready */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading || isStarting || isError || isStopped}
        placeholder={
          isStarting
            ? "Waiting for sandbox to start..."
            : isError
              ? "Session failed - cannot send messages"
              : isStopped
                ? "Session stopped"
                : "Send a message..."
        }
      />
    </div>
  );
}
