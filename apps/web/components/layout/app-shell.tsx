"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { RightPanel } from "./right-panel";

const SIDEBAR_STORAGE_KEY = "ship-sidebar-open";
const RIGHT_PANEL_STORAGE_KEY = "ship-right-panel-open";

interface AppShellProps {
  children: React.ReactNode;
  activeSessionId?: string;
  showDashboardLink?: boolean;
  topNavChildren?: React.ReactNode;
  session?: {
    _id: string;
    repoName: string;
    branch: string;
    status: string;
    createdAt: number;
    prUrl?: string;
    prNumber?: number;
    prStatus?: "draft" | "open" | "merged" | "closed";
    previewUrl?: string;
    filesChanged?: Array<{ path: string; additions: number; deletions: number }>;
    tasks?: Array<{ id: string; content: string; completed: boolean }>;
  } | null;
  showRightPanel?: boolean;
  onTaskToggle?: (taskId: string, completed: boolean) => void;
}

export function AppShell({
  children,
  activeSessionId,
  showDashboardLink = true,
  topNavChildren,
  session,
  showRightPanel = false,
  onTaskToggle,
}: AppShellProps) {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const user = useQuery(api.users.viewer);
  const sessions = useQuery(api.sessions.list, {});
  const router = useRouter();

  // Initialize sidebar state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedSidebar = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedSidebar !== null) {
      setSidebarOpen(storedSidebar === "true");
    }
    const storedRightPanel = localStorage.getItem(RIGHT_PANEL_STORAGE_KEY);
    if (storedRightPanel !== null) {
      setRightPanelOpen(storedRightPanel === "true");
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
  }, []);

  const toggleRightPanel = useCallback(() => {
    setRightPanelOpen((prev) => {
      const newValue = !prev;
      localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading state
  if (isLoading || !isAuthenticated || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          user={user || null}
          onToggleSidebar={toggleSidebar}
          onToggleRightPanel={showRightPanel ? toggleRightPanel : undefined}
          rightPanelOpen={rightPanelOpen}
          onSignOut={signOut}
          showDashboardLink={showDashboardLink}
        >
          {topNavChildren}
        </TopNav>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto">
            {children}
          </main>

          {/* Right Panel */}
          {showRightPanel && (
            <RightPanel
              session={session || null}
              isOpen={rightPanelOpen}
              onToggle={toggleRightPanel}
              onTaskToggle={onTaskToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
