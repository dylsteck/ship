"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { SidebarSessionItem } from "./sidebar-session-item";

type SessionStatus = "starting" | "running" | "idle" | "stopped" | "error";

interface Session {
  _id: string;
  repoName: string;
  branch: string;
  status: SessionStatus;
  updatedAt: number;
}

interface SidebarProps {
  sessions: Session[] | undefined;
  activeSessionId?: string;
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ sessions, activeSessionId, isOpen, onClose }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and group sessions
  const { thisMonth, earlier, filteredSessions } = useMemo(() => {
    if (!sessions) {
      return { thisMonth: [], earlier: [], filteredSessions: [] };
    }

    const filtered = searchQuery
      ? sessions.filter((s) =>
          s.repoName.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : sessions;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const thisMonth = filtered.filter((s) => s.updatedAt >= startOfMonth);
    const earlier = filtered.filter((s) => s.updatedAt < startOfMonth);

    return { thisMonth, earlier, filteredSessions: filtered };
  }, [sessions, searchQuery]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-50 w-[260px] bg-sidebar-bg border-r border-sidebar-border flex flex-col sidebar-transition",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:w-0 lg:border-r-0 lg:overflow-hidden"
        )}
      >
        <div className="flex flex-col h-full min-w-[260px]">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-bg-primary border border-sidebar-border text-sm placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>

          {/* New Session button */}
          <div className="px-3 pb-3">
            <Link
              href="/new"
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New Session
            </Link>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {sessions === undefined ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-sidebar-border border-t-accent" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-sm text-text-secondary">
                {searchQuery ? "No sessions found" : "No sessions yet"}
              </div>
            ) : (
              <div className="space-y-4">
                {/* This Month */}
                {thisMonth.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider px-3 mb-2">
                      This Month
                    </h3>
                    <div className="space-y-0.5">
                      {thisMonth.map((session) => (
                        <SidebarSessionItem
                          key={session._id}
                          id={session._id}
                          repoName={session.repoName}
                          status={session.status}
                          updatedAt={session.updatedAt}
                          isActive={session._id === activeSessionId}
                          onClick={onClose}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Earlier */}
                {earlier.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider px-3 mb-2">
                      Earlier
                    </h3>
                    <div className="space-y-0.5">
                      {earlier.map((session) => (
                        <SidebarSessionItem
                          key={session._id}
                          id={session._id}
                          repoName={session.repoName}
                          status={session.status}
                          updatedAt={session.updatedAt}
                          isActive={session._id === activeSessionId}
                          onClick={onClose}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
