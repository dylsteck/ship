"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import Link from "next/link";
import { ChatContainer } from "@/components/chat";

export default function SessionPage() {
  const params = useParams();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const sessionId = params.id as Id<"sessions">;
  const session = useQuery(api.sessions.get, { id: sessionId });
  const stopSession = useMutation(api.sessions.stop);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

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
          <Link
            href="/"
            className="text-accent hover:underline text-sm"
          >
            Back to dashboard
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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-sm font-medium">{session.repoName}</h1>
              <p className="text-xs text-text-secondary">{session.branch}</p>
            </div>
          </div>

          {(session.status === "running" || session.status === "idle") && (
            <button
              onClick={handleStop}
              className="text-xs text-error hover:text-error/80 transition-colors px-3 py-1.5 rounded-lg border border-error/30 hover:bg-error/10"
            >
              Stop Session
            </button>
          )}
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0">
        <ChatContainer sessionId={sessionId} />
      </div>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
