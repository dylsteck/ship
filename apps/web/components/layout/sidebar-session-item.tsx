"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { Id } from "@ship/convex/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { XIcon } from "@/components/ui/icons";

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
  const router = useRouter();
  const deleteSession = useMutation(api.sessions.deleteSession);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDeleting) return;
    
    if (!confirm(`Are you sure you want to delete "${repoName}"? This will also delete the sandbox if it exists.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete sandbox via API if it exists
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      await fetch(`${apiUrl}/sessions/${id}`, {
        method: "DELETE",
      }).catch(() => {
        // Ignore API errors - sandbox might already be deleted
      });

      // Delete from Convex
      await deleteSession({ id: id as Id<"sessions"> });
      
      // If we're on this session's page, redirect to home
      if (isActive) {
        router.push("/");
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      alert("Failed to delete session. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative group/item">
      <Link
        href={`/session/${id}`}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <StatusDot status={status} />
        <span className="truncate flex-1 min-w-0">{repoName}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity tabular-nums">
            {formatRelativeTime(updatedAt)}
          </span>
        </div>
      </Link>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity",
          "p-1 rounded hover:bg-sidebar-accent/80 text-muted-foreground hover:text-destructive",
          "z-10",
          isDeleting && "opacity-100 cursor-wait"
        )}
        title="Delete session"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
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
        status === "stopped" && "bg-muted-foreground/40",
        status === "error" && "bg-destructive"
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
