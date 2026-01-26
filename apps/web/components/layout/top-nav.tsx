"use client";

import Link from "next/link";
import { MenuIcon } from "@/components/ui/icons";
import { UserDropdown } from "./user-dropdown";

interface TopNavProps {
  user: {
    name?: string | null;
    image?: string | null;
    githubUsername?: string | null;
  } | null;
  onToggleSidebar: () => void;
  onSignOut: () => void;
  showDashboardLink?: boolean;
  children?: React.ReactNode;
}

export function TopNav({
  user,
  onToggleSidebar,
  onSignOut,
  showDashboardLink = true,
  children,
}: TopNavProps) {
  return (
    <header className="h-14 border-b border-border bg-bg-secondary shrink-0 flex items-center px-4 gap-4">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          aria-label="Toggle sidebar"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Link href="/" className="text-lg font-semibold text-text-primary">
          Ship
        </Link>
      </div>

      {/* Center section - slot for page-specific content */}
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {showDashboardLink ? (
          <Link
            href="/dashboard"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Sessions
          </Link>
        )}
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
