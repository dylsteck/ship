"use client";

import { useQuery } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { SessionList } from "@/components/session-list";

export default function DashboardPage() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const user = useQuery(api.users.viewer);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Ship</h1>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <span className="text-sm text-text-secondary">
                  {user.githubUsername}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Sessions</h2>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Session
          </Link>
        </div>

        <SessionList />
      </main>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
