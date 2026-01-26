"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth";
import { useRef } from "react";
import Link from "next/link";
import { ChatContainer } from "@/components/chat";
import { AppShell } from "@/components/layout";
import { cn } from "@/lib/utils";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const sessionId = params.id as Id<"sessions">;
  const session = useQuery(api.sessions.get, { id: sessionId });
  const stopSession = useMutation(api.sessions.stop);

  // Get initial prompt from URL if present
  const initialPrompt = searchParams.get("prompt") || undefined;
  const initialPromptSentRef = useRef(false);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-text-secondary">Session not found</p>
          <Link href="/" className="text-accent hover:underline text-sm">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const handleStop = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      await fetch(`${apiUrl}/sessions/${sessionId}/stop`, {
        method: "POST",
      });
      await stopSession({ id: sessionId });
    } catch (error) {
      console.error("Failed to stop session:", error);
    }
  };

  // Session info for top nav
  const sessionInfo = (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <StatusDot status={session.status} />
        <span className="text-sm font-medium">{session.repoName}</span>
        <span className="text-xs text-text-secondary">· {session.branch}</span>
      </div>
      {(session.status === "running" || session.status === "idle") && (
        <button
          onClick={handleStop}
          className="text-xs text-error hover:text-error/80 transition-colors px-3 py-1.5 rounded-lg border border-error/30 hover:bg-error/10"
        >
          Stop
        </button>
      )}
    </div>
  );

  return (
    <AppShell activeSessionId={sessionId} topNavChildren={sessionInfo}>
      <div className="h-full flex flex-col">
        <ChatContainer
          sessionId={sessionId}
          initialPrompt={!initialPromptSentRef.current ? initialPrompt : undefined}
          onInitialPromptSent={() => {
            initialPromptSentRef.current = true;
          }}
        />
      </div>
    </AppShell>
  );
}

type SessionStatus = "starting" | "running" | "idle" | "stopped" | "error";

function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        status === "running" && "bg-success animate-pulse-dot",
        status === "idle" && "bg-success",
        status === "starting" && "bg-warning animate-pulse-dot",
        status === "stopped" && "bg-text-secondary/50",
        status === "error" && "bg-error"
      )}
    />
  );
}
