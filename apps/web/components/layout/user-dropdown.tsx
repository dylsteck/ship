"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LayoutDashboardIcon, LogOutIcon, MessageSquareIcon } from "@/components/ui/icons";

interface UserDropdownProps {
  user: {
    name?: string | null;
    image?: string | null;
    githubUsername?: string | null;
  };
  onSignOut: () => void;
  showDashboardLink?: boolean;
}

export function UserDropdown({ user, onSignOut, showDashboardLink = true }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
      >
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || "User"}
            className="h-8 w-8 rounded-full ring-2 ring-transparent hover:ring-border transition-all"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-sidebar-border bg-sidebar-bg shadow-lg overflow-hidden z-50">
          {/* User info section */}
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.name || "User"}
                </p>
                {user.githubUsername && (
                  <p className="text-xs text-text-secondary truncate">
                    @{user.githubUsername}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {showDashboardLink ? (
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-hover-bg hover:text-text-primary transition-colors"
              >
                <LayoutDashboardIcon className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-hover-bg hover:text-text-primary transition-colors"
              >
                <MessageSquareIcon className="h-4 w-4" />
                Sessions
              </Link>
            )}
          </div>

          {/* Sign out */}
          <div className="border-t border-sidebar-border py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-hover-bg hover:text-text-primary transition-colors"
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
