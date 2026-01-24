"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { useState, useCallback } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { cn } from "@/lib/utils";

interface ChatContainerProps {
  sessionId: Id<"sessions">;
}

export function ChatContainer({ sessionId }: ChatContainerProps) {
  const session = useQuery(api.sessions.get, { id: sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);

  const [streamingContent, setStreamingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const isRunning = session.status === "running";
  const isStarting = session.status === "starting";
  const isError = session.status === "error";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 bg-bg-secondary">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <StatusIndicator status={session.status} />
            <div>
              <h2 className="font-medium text-sm">{session.repoName}</h2>
              <p className="text-xs text-text-secondary">{session.branch}</p>
            </div>
          </div>
        </div>
      </div>

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
          disabled={isLoading || !isRunning}
          placeholder={
            isRunning
              ? "Send a message..."
              : "Session is not running"
          }
        />
      )}
    </div>
  );
}

function StatusIndicator({
  status,
}: {
  status: "starting" | "running" | "idle" | "stopped" | "error";
}) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        status === "running" && "bg-success animate-pulse",
        status === "idle" && "bg-success",
        status === "starting" && "bg-warning animate-pulse",
        status === "stopped" && "bg-text-secondary",
        status === "error" && "bg-error"
      )}
    />
  );
}
