"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MenuIcon, PanelRightIcon } from "@/components/ui/icons";
import { UserDropdown } from "./user-dropdown";
import { cn } from "@/lib/utils";

interface TopNavProps {
  user: {
    name?: string | null;
    image?: string | null;
    githubUsername?: string | null;
  } | null;
  onToggleSidebar: () => void;
  onToggleRightPanel?: () => void;
  rightPanelOpen?: boolean;
  onSignOut: () => void;
  showDashboardLink?: boolean;
  children?: React.ReactNode;
}

export function TopNav({
  user,
  onToggleSidebar,
  onToggleRightPanel,
  rightPanelOpen,
  onSignOut,
  showDashboardLink = true,
  children,
}: TopNavProps) {
  return (
    <header className="h-14 border-b border-border bg-background shrink-0 flex items-center px-4 gap-4">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8"
          aria-label="Toggle sidebar"
        >
          <MenuIcon className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Link href="/" className="text-base font-semibold tracking-tight">
          Ship
        </Link>
      </div>

      {/* Center section - slot for page-specific content */}
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {onToggleRightPanel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleRightPanel}
            className={cn("h-8 w-8 hidden lg:flex", rightPanelOpen && "bg-muted")}
            aria-label="Toggle details panel"
          >
            <PanelRightIcon className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          {showDashboardLink ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/">Sessions</Link>
          )}
        </Button>
        {user && (
          <UserDropdown
            user={user}
            onSignOut={onSignOut}
            showDashboardLink={showDashboardLink}
          />
        )}
      </div>
    </header>
  );
}
