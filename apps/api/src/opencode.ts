export interface OpenCodeMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  data: unknown;
}

export class OpenCodeClient {
  private baseUrl: string;

  constructor(tunnelUrl: string) {
    this.baseUrl = tunnelUrl.replace(/\/$/, "");
  }

  async sendMessage(
    content: string,
    onEvent: (event: StreamEvent) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: content,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenCode error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onEvent({ type: "done", data: null });
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "text") {
              onEvent({ type: "text", data: parsed.content });
            } else if (parsed.type === "tool_call") {
              onEvent({ type: "tool_call", data: parsed.toolCall });
            } else if (parsed.type === "tool_result") {
              onEvent({ type: "tool_result", data: parsed.toolResult });
            } else if (parsed.type === "error") {
              onEvent({ type: "error", data: parsed.error });
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      }
    }
  }

  async getStatus(): Promise<{ status: "ready" | "busy" | "error" }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        return { status: "error" };
      }
      return await response.json();
    } catch {
      return { status: "error" };
    }
  }

  async stop(): Promise<void> {
    await fetch(`${this.baseUrl}/stop`, { method: "POST" });
  }
}
