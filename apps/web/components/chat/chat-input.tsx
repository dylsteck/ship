"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { SendIcon, CpuIcon, ChevronDownIcon } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MODELS = [
  { id: "claude-opus-4.5", name: "Claude Opus 4.5", description: "Most capable" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Fast & capable" },
] as const;

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Ask or build anything",
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]>(MODELS[0]);
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
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="max-w-4xl mx-auto">
        {/* Input area */}
        <div className="relative rounded-xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring transition-all">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent",
              "px-4 pt-3 pb-12 text-sm placeholder:text-muted-foreground",
              "focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                >
                  <CpuIcon className="h-3.5 w-3.5" />
                  <span className="font-mono lowercase">{selectedModel.name.toLowerCase().replace(" ", " ")}</span>
                  <ChevronDownIcon className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {MODELS.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right side - mode toggle and send */}
            <div className="flex items-center gap-2">
              {content.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60">
                  {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter
                </span>
              )}
              <Button
                onClick={handleSubmit}
                disabled={disabled || !content.trim()}
                size="sm"
                className="h-7 w-7 p-0"
              >
                <SendIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
