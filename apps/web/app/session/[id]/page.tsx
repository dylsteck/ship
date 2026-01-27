"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth";
import { useRef, useCallback } from "react";
import Link from "next/link";
import { ChatContainer } from "@/components/chat";
import { AppShell } from "@/components/layout";
import { ActionBar } from "@/components/session/action-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const sessionId = params.id as Id<"sessions">;
  const session = useQuery(api.sessions.get, { id: sessionId });
  const stopSession = useMutation(api.sessions.stop);
  const updateTasks = useMutation(api.sessions.updateTasks);

  const initialPrompt = searchParams.get("prompt") || undefined;
  const initialPromptSentRef = useRef(false);

  const handleTaskToggle = useCallback(
    async (taskId: string, completed: boolean) => {
      if (!session?.tasks) return;
      const updatedTasks = session.tasks.map((task) =>
        task.id === taskId ? { ...task, completed } : task
      );
      await updateTasks({ id: sessionId, tasks: updatedTasks });
    },
    [session?.tasks, sessionId, updateTasks]
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Session not found</p>
          <Button variant="link" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
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

  const sessionInfo = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <StatusDot status={session.status} />
        <span className="text-sm font-medium">{session.repoName}</span>
        <Badge variant="secondary" className="text-xs font-normal">
          {session.branch}
        </Badge>
      </div>
      {(session.status === "running" || session.status === "idle") && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          Stop
        </Button>
      )}
    </div>
  );

  // Transform session to match RightPanel expected shape
  const sessionForPanel = {
    _id: session._id,
    repoName: session.repoName,
    branch: session.branch,
    status: session.status,
    createdAt: session.createdAt,
    prUrl: session.prUrl,
    prNumber: session.prNumber,
    prStatus: session.prStatus,
    previewUrl: session.previewUrl,
    filesChanged: session.filesChanged,
    tasks: session.tasks,
  };

  return (
    <AppShell
      activeSessionId={sessionId}
      topNavChildren={sessionInfo}
      session={sessionForPanel}
      showRightPanel
      onTaskToggle={handleTaskToggle}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatContainer
            sessionId={sessionId}
            initialPrompt={!initialPromptSentRef.current ? initialPrompt : undefined}
            onInitialPromptSent={() => {
              initialPromptSentRef.current = true;
            }}
          />
        </div>
        {/* Action Bar */}
        <ActionBar
          previewUrl={session.previewUrl}
          prUrl={session.prUrl}
          sessionId={sessionId}
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
        status === "stopped" && "bg-muted-foreground/40",
        status === "error" && "bg-destructive"
      )}
    />
  );
}
