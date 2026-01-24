"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Send a message...",
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setContent("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-bg-secondary px-4 py-4">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl bg-bg-elevated border border-border",
              "px-4 py-3 text-sm placeholder:text-text-secondary",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          />
          <div className="absolute right-3 bottom-2 text-xs text-text-secondary">
            {content.length > 0 && (
              <span className="opacity-60">
                {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to send
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={disabled || !content.trim()}
          className={cn(
            "rounded-xl px-4 py-3 font-medium text-sm transition-colors",
            "bg-accent text-white",
            "hover:bg-accent/90",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus:outline-none focus:ring-2 focus:ring-accent/50"
          )}
        >
          <SendIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
