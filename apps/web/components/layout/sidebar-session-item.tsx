"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type SessionStatus = "starting" | "running" | "idle" | "stopped" | "error";

interface SidebarSessionItemProps {
  id: string;
  repoName: string;
  status: SessionStatus;
  updatedAt: number;
  isActive?: boolean;
  onClick?: () => void;
}

export function SidebarSessionItem({
  id,
  repoName,
  status,
  updatedAt,
  isActive = false,
  onClick,
}: SidebarSessionItemProps) {
  return (
    <Link
      href={`/session/${id}`}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group",
        isActive
          ? "bg-accent/10 text-text-primary"
          : "text-text-secondary hover:bg-hover-bg hover:text-text-primary"
      )}
    >
      <StatusDot status={status} />
      <span className="truncate flex-1 min-w-0">{repoName}</span>
      <span className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {formatRelativeTime(updatedAt)}
      </span>
    </Link>
  );
}

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

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "now";
}
