"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  result: unknown;
}

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  result?: ToolResult;
}

export function ToolCallDisplay({ toolCall, result }: ToolCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolIcon = (name: string) => {
    if (name.includes("file") || name.includes("read") || name.includes("write")) {
      return "file";
    }
    if (name.includes("exec") || name.includes("run") || name.includes("shell")) {
      return "terminal";
    }
    if (name.includes("search") || name.includes("find")) {
      return "search";
    }
    return "tool";
  };

  const icon = getToolIcon(toolCall.name);

  return (
    <div className="rounded-lg bg-bg-secondary border border-border overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-primary/50 transition-colors"
      >
        <ToolIcon type={icon} className="h-4 w-4 text-text-secondary" />
        <span className="font-mono text-xs text-text-primary truncate flex-1">
          {toolCall.name}
        </span>
        <ChevronIcon
          className={cn(
            "h-4 w-4 text-text-secondary transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <div className="text-xs text-text-secondary mb-1">Arguments</div>
            <pre className="text-xs font-mono bg-bg-primary p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {result && (
            <div>
              <div className="text-xs text-text-secondary mb-1">Result</div>
              <pre className="text-xs font-mono bg-bg-primary p-2 rounded overflow-x-auto max-h-40">
                {typeof result.result === "string"
                  ? result.result
                  : JSON.stringify(result.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolIcon({ type, className }: { type: string; className?: string }) {
  if (type === "file") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  }

  if (type === "terminal") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    );
  }

  if (type === "search") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
