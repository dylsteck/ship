"use client";

import { cn } from "@/lib/utils";
import { ToolCallDisplay } from "./tool-call-display";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface Message {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  createdAt: number;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-text-secondary bg-bg-secondary px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-accent text-white"
            : "bg-bg-elevated border border-border"
        )}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallDisplay
                key={toolCall.id}
                toolCall={toolCall}
                result={message.toolResults?.find(
                  (r) => r.toolCallId === toolCall.id
                )}
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "text-xs mt-2",
            isUser ? "text-white/70" : "text-text-secondary"
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
