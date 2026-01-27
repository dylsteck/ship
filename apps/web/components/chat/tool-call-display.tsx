"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { FileIcon, TerminalIcon, SearchIcon, ChevronDownIcon } from "@/components/ui/icons";

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

  const getToolInfo = (name: string) => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("read") || nameLower.includes("file")) {
      return { icon: FileIcon, label: "Read", color: "text-blue-600 bg-blue-50" };
    }
    if (nameLower.includes("write") || nameLower.includes("edit")) {
      return { icon: FileIcon, label: "Edit", color: "text-amber-600 bg-amber-50" };
    }
    if (nameLower.includes("exec") || nameLower.includes("run") || nameLower.includes("shell") || nameLower.includes("bash")) {
      return { icon: TerminalIcon, label: "Run", color: "text-green-600 bg-green-50" };
    }
    if (nameLower.includes("search") || nameLower.includes("find") || nameLower.includes("grep")) {
      return { icon: SearchIcon, label: "Search", color: "text-purple-600 bg-purple-50" };
    }
    return { icon: TerminalIcon, label: "Tool", color: "text-gray-600 bg-gray-50" };
  };

  const { icon: Icon, label, color } = getToolInfo(toolCall.name);

  // Get a short description of what the tool is doing
  const getShortDescription = () => {
    const args = toolCall.arguments;
    if (args.path && typeof args.path === "string") {
      const fileName = args.path.split("/").pop();
      return fileName;
    }
    if (args.command && typeof args.command === "string") {
      return args.command.split(" ")[0];
    }
    if (args.query && typeof args.query === "string") {
      return args.query.substring(0, 30) + (args.query.length > 30 ? "..." : "");
    }
    return toolCall.name;
  };

  const hasResult = !!result;
  const isPending = !hasResult;

  return (
    <div className="group">
      {/* Inline action badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
          color,
          "hover:opacity-80",
          isPending && "opacity-70"
        )}
      >
        {isPending && (
          <div className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
        )}
        {!isPending && <Icon className="h-3 w-3" />}
        <span>{label}</span>
        <span className="font-mono text-[10px] opacity-70 max-w-[150px] truncate">
          {getShortDescription()}
        </span>
        {hasResult && (
          <ChevronDownIcon
            className={cn(
              "h-3 w-3 opacity-50 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 overflow-hidden">
          <div className="px-3 py-2 space-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {toolCall.name}
              </div>
              <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto text-muted-foreground">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>

            {result && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Result
                </div>
                <pre className="text-xs font-mono bg-background p-2 rounded overflow-x-auto max-h-40 text-foreground">
                  {typeof result.result === "string"
                    ? result.result.substring(0, 500) + (typeof result.result === "string" && result.result.length > 500 ? "..." : "")
                    : JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
