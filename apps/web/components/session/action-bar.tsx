"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GlobeIcon,
  GitPullRequestIcon,
  ArchiveIcon,
  MoreHorizontalIcon,
} from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Id } from "@ship/convex/convex/_generated/dataModel";

interface ActionBarProps {
  previewUrl?: string;
  prUrl?: string;
  sessionId: Id<"sessions">;
  onArchive?: () => void;
}

export function ActionBar({ previewUrl, prUrl, sessionId, onArchive }: ActionBarProps) {
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    if (onArchive) {
      setIsArchiving(true);
      try {
        await onArchive();
      } finally {
        setIsArchiving(false);
      }
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2">
        {/* View Preview */}
        {previewUrl && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
          >
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <GlobeIcon className="h-4 w-4" />
              View preview
            </a>
          </Button>
        )}

        {/* View PR */}
        {prUrl && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
          >
            <a href={prUrl} target="_blank" rel="noopener noreferrer">
              <GitPullRequestIcon className="h-4 w-4" />
              View PR
            </a>
          </Button>
        )}

        {/* Archive (if no preview or PR, show as button) */}
        {onArchive && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={isArchiving}
            className="gap-2"
          >
            <ArchiveIcon className="h-4 w-4" />
            Archive
          </Button>
        )}

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!previewUrl && (
              <DropdownMenuItem disabled>
                <GlobeIcon className="h-4 w-4 mr-2" />
                No preview available
              </DropdownMenuItem>
            )}
            {!prUrl && (
              <DropdownMenuItem disabled>
                <GitPullRequestIcon className="h-4 w-4 mr-2" />
                No PR created yet
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleArchive} disabled={isArchiving}>
              <ArchiveIcon className="h-4 w-4 mr-2" />
              Archive session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
