"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

const SIDEBAR_STORAGE_KEY = "ship-sidebar-open";

interface AppShellProps {
  children: React.ReactNode;
  activeSessionId?: string;
  showDashboardLink?: boolean;
  topNavChildren?: React.ReactNode;
}

export function AppShell({
  children,
  activeSessionId,
  showDashboardLink = true,
  topNavChildren,
}: AppShellProps) {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const user = useQuery(api.users.viewer);
  const sessions = useQuery(api.sessions.list, {});
  const router = useRouter();

  // Initialize sidebar state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setSidebarOpen(stored === "true");
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
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
          onSignOut={signOut}
          showDashboardLink={showDashboardLink}
        >
          {topNavChildren}
        </TopNav>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
