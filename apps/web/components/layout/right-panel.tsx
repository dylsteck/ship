"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronRightIcon,
  ClockIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  FileIcon,
  CheckCircleIcon,
  CircleIcon,
  UserIcon,
  CpuIcon,
} from "@/components/ui/icons";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
}

interface Task {
  id: string;
  content: string;
  completed: boolean;
}

interface RightPanelProps {
  session: {
    _id: string;
    repoName: string;
    branch: string;
    status: string;
    createdAt: number;
    prUrl?: string;
    prNumber?: number;
    prStatus?: "draft" | "open" | "merged" | "closed";
    previewUrl?: string;
    filesChanged?: FileChange[];
    tasks?: Task[];
  } | null;
  isOpen: boolean;
  onToggle: () => void;
  onTaskToggle?: (taskId: string, completed: boolean) => void;
}

export function RightPanel({ session, isOpen, onToggle, onTaskToggle }: RightPanelProps) {
  if (!session) return null;

  const age = getRelativeTime(session.createdAt);

  return (
    <>
      {/* Toggle button when closed */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="fixed right-4 top-16 z-30 h-8 w-8 p-0 bg-background border shadow-sm"
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
        </Button>
      )}

      {/* Panel */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-l border-border bg-background panel-transition shrink-0",
          isOpen ? "w-[300px]" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex flex-col h-full min-w-[300px] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-medium">Details</h2>
            <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Metadata */}
          <div className="p-4 space-y-3 border-b border-border">
            <MetadataRow icon={UserIcon} label="1 prompt engineer" />
            <MetadataRow icon={ClockIcon} label={age} />
            <MetadataRow icon={CpuIcon} label="Claude Opus 4.5" />
            {session.prUrl && session.prNumber && (
              <MetadataRow
                icon={GitPullRequestIcon}
                label={`#${session.prNumber}`}
                badge={session.prStatus}
                href={session.prUrl}
              />
            )}
            <MetadataRow icon={GitBranchIcon} label={session.branch} />
            <MetadataRow
              icon={FileIcon}
              label={session.repoName}
              className="text-muted-foreground"
            />
          </div>

          {/* Tasks */}
          {session.tasks && session.tasks.length > 0 && (
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Tasks
              </h3>
              <div className="space-y-2">
                {session.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={onTaskToggle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Files Changed */}
          {session.filesChanged && session.filesChanged.length > 0 && (
            <div className="p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Files changed
              </h3>
              <div className="space-y-1">
                {session.filesChanged.map((file) => (
                  <FileChangeItem key={file.path} file={file} />
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

interface MetadataRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: "draft" | "open" | "merged" | "closed";
  href?: string;
  className?: string;
}

function MetadataRow({ icon: Icon, label, badge, href, className }: MetadataRowProps) {
  const content = (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
      {badge && (
        <span
          className={cn(
            "px-1.5 py-0.5 text-[10px] font-medium rounded-full",
            badge === "merged" && "bg-purple-100 text-purple-700",
            badge === "open" && "bg-green-100 text-green-700",
            badge === "draft" && "bg-gray-100 text-gray-700",
            badge === "closed" && "bg-red-100 text-red-700"
          )}
        >
          {badge.charAt(0).toUpperCase() + badge.slice(1)}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-muted rounded-md -mx-2 px-2 py-1 transition-colors"
      >
        {content}
      </a>
    );
  }

  return content;
}

interface TaskItemProps {
  task: Task;
  onToggle?: (taskId: string, completed: boolean) => void;
}

function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <button
      onClick={() => onToggle?.(task.id, !task.completed)}
      className="flex items-start gap-2 text-sm text-left w-full hover:bg-muted rounded-md -mx-2 px-2 py-1 transition-colors"
    >
      {task.completed ? (
        <CheckCircleIcon className="h-4 w-4 text-success shrink-0 mt-0.5" />
      ) : (
        <CircleIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <span className={cn(task.completed && "line-through text-muted-foreground")}>
        {task.content}
      </span>
    </button>
  );
}

interface FileChangeItemProps {
  file: FileChange;
}

function FileChangeItem({ file }: FileChangeItemProps) {
  const fileName = file.path.split("/").pop() || file.path;
  const dirPath = file.path.split("/").slice(0, -1).join("/");

  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-1.5 min-w-0">
        <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{fileName}</span>
        {dirPath && (
          <span className="text-muted-foreground text-xs truncate hidden sm:inline">
            {dirPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs shrink-0 ml-2">
        {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-error">-{file.deletions}</span>}
      </div>
    </div>
  );
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
