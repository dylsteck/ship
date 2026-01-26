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
  const [isLoading, setIsLoading] = useState(false);
  const initialPromptSentRef = useRef(false);

  const handleSend = useCallback(
    async (content: string) => {
      if (!session) return;

      setIsLoading(true);
      setStreamingContent("");

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
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "text") {
                  accumulated += parsed.data;
                  setStreamingContent(accumulated);
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsLoading(false);
        setStreamingContent("");
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const isRunning = session.status === "running";
  const isStarting = session.status === "starting";
  const isIdle = session.status === "idle";
  const isError = session.status === "error";

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <MessageList
        messages={(messages || []) as any}
        streamingContent={isLoading ? streamingContent : undefined}
      />

      {/* Input */}
      {isError ? (
        <div className="border-t border-border bg-bg-secondary px-4 py-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-error">{session.errorMessage || "An error occurred"}</p>
          </div>
        </div>
      ) : isStarting ? (
        <div className="border-t border-border bg-bg-secondary px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-sm text-text-secondary">Starting sandbox...</span>
          </div>
        </div>
      ) : (
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !(isRunning || isIdle)}
          placeholder={
            isRunning || isIdle
              ? "Send a message..."
              : "Session is not running"
          }
        />
      )}
    </div>
  );
}
