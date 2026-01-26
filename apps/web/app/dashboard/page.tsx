"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GithubIcon, CheckIcon, UserIcon, SettingsIcon } from "@/components/ui/icons";

type DashboardTab = "overview" | "settings";

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const user = useQuery(api.users.viewer);
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const sidebarItems = [
    { id: "overview" as const, label: "Overview", icon: UserIcon },
    { id: "settings" as const, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Dashboard Sidebar */}
      <aside className="w-[260px] bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0">
        {/* User info */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || "User"}
                className="h-12 w-12 rounded-full"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">
                {user?.name || "User"}
              </p>
              {user?.githubUsername && (
                <p className="text-xs text-text-secondary truncate">
                  @{user.githubUsername}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  activeTab === item.id
                    ? "bg-accent/10 text-text-primary"
                    : "text-text-secondary hover:bg-hover-bg hover:text-text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Back to sessions */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
          >
            ← Back to Sessions
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-semibold mb-2">Account</h1>
                <p className="text-text-secondary">
                  Manage your account settings and integrations.
                </p>
              </div>

              {/* Profile section */}
              <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  Profile
                </h2>
                <div className="bg-bg-elevated border border-border rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    {user?.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "User"}
                        className="h-16 w-16 rounded-full"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-bg-secondary flex items-center justify-center text-text-secondary text-xl">
                        {user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div>
                      <p className="text-lg font-medium">{user?.name || "User"}</p>
                      {user?.githubUsername && (
                        <p className="text-sm text-text-secondary">@{user.githubUsername}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* GitHub Integration */}
              <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  Integrations
                </h2>
                <div className="bg-bg-elevated border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-bg-secondary flex items-center justify-center">
                        <GithubIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">GitHub</p>
                        <p className="text-sm text-text-secondary">
                          {user?.githubUsername ? (
                            <>Connected as @{user.githubUsername}</>
                          ) : (
                            "Not connected"
                          )}
                        </p>
                      </div>
                    </div>
                    {user?.githubUsername && (
                      <div className="flex items-center gap-2 text-success text-sm">
                        <CheckIcon className="h-4 w-4" />
                        Connected
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Danger zone */}
              <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  Session
                </h2>
                <div className="bg-bg-elevated border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sign out</p>
                      <p className="text-sm text-text-secondary">
                        Sign out of your account on this device.
                      </p>
                    </div>
                    <button
                      onClick={() => signOut()}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-hover-bg transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-semibold mb-2">Settings</h1>
                <p className="text-text-secondary">
                  Customize your Ship experience.
                </p>
              </div>

              {/* Appearance */}
              <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  Appearance
                </h2>
                <div className="bg-bg-elevated border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Theme</p>
                      <p className="text-sm text-text-secondary">
                        Choose your preferred color scheme.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary text-sm">
                      <span className="h-2 w-2 rounded-full bg-text-primary" />
                      Dark
                    </div>
                  </div>
                </div>
              </section>

              {/* About */}
              <section className="space-y-4">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  About
                </h2>
                <div className="bg-bg-elevated border border-border rounded-xl p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Version</span>
                      <span className="text-sm">1.0.0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Built with</span>
                      <span className="text-sm">Next.js, Convex, Tailwind</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
