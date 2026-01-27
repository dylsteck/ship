"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type Message } from "./message-bubble";
import { TerminalIcon } from "@/components/ui/icons";

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  streamingToolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  streamingToolResults?: Array<{ toolCallId: string; result: unknown }>;
}

export function MessageList({ messages, streamingContent, streamingToolCalls, streamingToolResults }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, streamingToolCalls, streamingToolResults]);

  if (messages.length === 0 && !streamingContent && !streamingToolCalls) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 px-4 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <TerminalIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ready to code</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Send a message to start working on this repository. The agent can
              read files, make edits, run commands, and create PRs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-6 divide-y divide-border/50">
        {messages.map((message) => (
          <MessageBubble key={message._id} message={message} />
        ))}

        {(streamingContent || streamingToolCalls) && (
          <MessageBubble
            message={{
              _id: "streaming",
              role: "assistant",
              content: streamingContent || "",
              toolCalls: streamingToolCalls,
              toolResults: streamingToolResults,
              createdAt: Date.now(),
            }}
            isStreaming
          />
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
