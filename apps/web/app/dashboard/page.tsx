"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  GithubIcon,
  CheckIcon,
  UserIcon,
  SettingsIcon,
  MessageSquareIcon,
} from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme-toggle";

type DashboardTab = "overview" | "settings" | "integrations";

// Icons for navigation
function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IntegrationsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const user = useQuery(api.users.viewer);
  const sessions = useQuery(api.sessions.list, {});
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  // Calculate stats
  const totalSessions = sessions?.length || 0;
  const activeSessions = sessions?.filter(s => s.status === "running" || s.status === "idle").length || 0;

  const navItems = [
    { id: "overview" as const, label: "Overview", icon: OverviewIcon },
    { id: "settings" as const, label: "Settings", icon: SettingsIcon },
    { id: "integrations" as const, label: "Integrations", icon: IntegrationsIcon },
  ];

  const secondaryNavItems = [
    { label: "Sessions", icon: MessageSquareIcon, onClick: () => router.push("/") },
  ];

  const footerNavItems = [
    { label: "Docs", icon: DocsIcon, href: "#" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[240px] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <span className="text-base font-semibold">Ship</span>
        </div>

        {/* User info */}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{user?.name || "User"}</span>
            <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user?.githubUsername ? `@${user.githubUsername}` : user?.email || ""}
          </p>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 px-2">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  activeTab === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          <Separator className="my-4 bg-sidebar-border" />

          <div className="space-y-0.5">
            {secondaryNavItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          <Separator className="my-4 bg-sidebar-border" />

          <div className="space-y-0.5">
            {footerNavItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Sign out */}
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-end px-6 border-b border-border">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sessions
            </button>
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
              <AvatarFallback className="text-xs bg-muted">
                {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "overview" && (
            <div className="max-w-4xl space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sessions</p>
                        <p className="text-3xl font-semibold mt-1 tabular-nums">{totalSessions}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">All time</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Sessions</p>
                        <p className="text-3xl font-semibold mt-1 tabular-nums">{activeSessions}</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        activeSessions > 0 ? "text-success border-success/50" : "text-muted-foreground"
                      )}>
                        {activeSessions > 0 ? "Running" : "None"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Activity Section */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">Your Activity</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">30d</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Sessions Created
                      </p>
                      <p className="text-2xl font-semibold mt-1 tabular-nums">
                        {totalSessions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Repositories Used</p>
                      <p className="text-2xl font-semibold mt-1 tabular-nums">
                        {new Set(sessions?.map(s => s.repoName) || []).size}
                      </p>
                    </div>
                  </div>

                  {/* Simple activity indicator */}
                  <div className="mt-6 h-24 flex items-end gap-1">
                    {Array.from({ length: 30 }).map((_, i) => {
                      const height = Math.random() * 80 + 20;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-muted rounded-sm transition-all hover:bg-muted/80"
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Sessions */}
              {sessions && sessions.length > 0 && (
                <Card className="bg-card border-border">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-medium mb-4">Recent Sessions</h3>
                    <div className="space-y-2">
                      {sessions.slice(0, 5).map((session) => (
                        <button
                          key={session._id}
                          onClick={() => router.push(`/session/${session._id}`)}
                          className="w-full flex items-center justify-between p-3 rounded-lg bg-background hover:bg-accent transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-2 w-2 rounded-full",
                              session.status === "running" && "bg-success animate-pulse",
                              session.status === "idle" && "bg-success",
                              session.status === "starting" && "bg-warning animate-pulse",
                              session.status === "stopped" && "bg-muted-foreground/40",
                              session.status === "error" && "bg-destructive"
                            )} />
                            <div>
                              <p className="text-sm font-medium">{session.repoName}</p>
                              <p className="text-xs text-muted-foreground">{session.branch}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {session.status}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your account preferences.
                </p>
              </div>

              {/* Profile */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <h3 className="text-sm font-medium mb-4">Profile</h3>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-border">
                      <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                      <AvatarFallback className="text-lg bg-muted">
                        {user?.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user?.name || "User"}</p>
                      {user?.githubUsername && (
                        <p className="text-sm text-muted-foreground">@{user.githubUsername}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Appearance */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <h3 className="text-sm font-medium mb-4">Appearance</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Theme</p>
                      <p className="text-xs text-muted-foreground">
                        Choose your preferred color scheme.
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                </CardContent>
              </Card>

              {/* About */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <h3 className="text-sm font-medium mb-4">About</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span>1.0.0</span>
                    </div>
                    <Separator className="bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Stack</span>
                      <span>Next.js · Convex · OpenCode</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Integrations</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Connect external services and tools.
                </p>
              </div>

              {/* GitHub */}
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <GithubIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">GitHub</p>
                        <p className="text-sm text-muted-foreground">
                          {user?.githubUsername ? (
                            <>Connected as @{user.githubUsername}</>
                          ) : (
                            "Not connected"
                          )}
                        </p>
                      </div>
                    </div>
                    {user?.githubUsername && (
                      <Badge className="bg-success/10 text-success border-0">
                        <CheckIcon className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* More integrations placeholder */}
              <Card className="bg-card border-border border-dashed">
                <CardContent className="p-5">
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      More integrations coming soon
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
