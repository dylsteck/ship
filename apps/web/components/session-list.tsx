"use client";

import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SessionStatus = "starting" | "running" | "idle" | "stopped" | "error";

interface Session {
  _id: string;
  repoName: string;
  branch: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
}

interface SessionListProps {
  filter?: SessionStatus;
}

export function SessionList({ filter }: SessionListProps) {
  const sessions = useQuery(api.sessions.list, { status: filter }) as Session[] | undefined;

  if (!sessions) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">No sessions yet</p>
        <p className="text-sm text-text-secondary mt-1">
          Create a new session to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <SessionCard key={session._id} session={session} />
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  return (
    <Link
      href={`/session/${session._id}`}
      className="block rounded-xl border border-border bg-bg-elevated p-4 transition-colors hover:bg-bg-secondary"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIndicator status={session.status} />
            <h3 className="font-medium text-sm truncate">{session.repoName}</h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">{session.branch}</p>
        </div>

        <div className="text-right shrink-0">
          <StatusBadge status={session.status} />
          <p className="text-xs text-text-secondary mt-1">
            {formatRelativeTime(session.updatedAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function StatusIndicator({ status }: { status: SessionStatus }) {
  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full shrink-0",
        status === "running" && "bg-success animate-pulse",
        status === "idle" && "bg-success",
        status === "starting" && "bg-warning animate-pulse",
        status === "stopped" && "bg-text-secondary",
        status === "error" && "bg-error"
      )}
    />
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = {
    starting: "Starting",
    running: "Running",
    idle: "Idle",
    stopped: "Stopped",
    error: "Error",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        status === "running" && "bg-success/20 text-success",
        status === "idle" && "bg-success/20 text-success",
        status === "starting" && "bg-warning/20 text-warning",
        status === "stopped" && "bg-text-secondary/20 text-text-secondary",
        status === "error" && "bg-error/20 text-error"
      )}
    >
      {labels[status]}
    </span>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}
