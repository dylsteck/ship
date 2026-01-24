"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type Message } from "./message-bubble";

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
}

export function MessageList({ messages, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 px-4">
          <div className="text-4xl">{'>'}_</div>
          <h2 className="text-lg font-medium">Ready to code</h2>
          <p className="text-sm text-text-secondary max-w-sm">
            Send a message to start working on this repository. The agent can
            read files, make edits, run commands, and create PRs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      {messages.map((message) => (
        <MessageBubble key={message._id} message={message} />
      ))}

      {streamingContent && (
        <MessageBubble
          message={{
            _id: "streaming",
            role: "assistant",
            content: streamingContent,
            createdAt: Date.now(),
          }}
          isStreaming
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
