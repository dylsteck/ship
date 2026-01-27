"use client";

import { cn } from "@/lib/utils";
import { ToolCallDisplay } from "./tool-call-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-4">
      {/* Avatar */}
      <div className="shrink-0">
        {isUser ? (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              You
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-8 w-8 bg-amber-100">
            <AvatarFallback className="bg-amber-100 text-amber-800 text-xs">
              AI
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Message content */}
        {(message.content || isStreaming) && (
          <div
            className={cn(
              "text-sm leading-relaxed",
              isUser
                ? "bg-muted rounded-lg px-4 py-3 inline-block max-w-[90%]"
                : "text-foreground"
            )}
          >
            <div className="whitespace-pre-wrap break-words">
              {message.content || (isStreaming && !message.toolCalls?.length ? "Thinking..." : "")}
              {isStreaming && message.content && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        )}

        {/* Tool calls - displayed inline as action badges */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className={cn("space-y-2", message.content ? "mt-3" : "")}>
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

        {/* Timestamp */}
        <div className="text-[10px] text-muted-foreground mt-1">
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
