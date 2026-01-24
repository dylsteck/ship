"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RepoSelector } from "@/components/repo-selector";

export default function NewSessionPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const user = useQuery(api.users.current);
  const createSession = useMutation(api.sessions.create);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  const handleSelectRepo = async (
    repo: { fullName: string; cloneUrl: string },
    branch: string
  ) => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      // Create session in Convex
      const sessionId = await createSession({
        repoUrl: repo.cloneUrl,
        repoName: repo.fullName,
        branch,
      });

      // Trigger sandbox creation via API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      await fetch(`${apiUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          repoUrl: repo.cloneUrl,
          branch,
          githubToken: user.githubAccessToken,
        }),
      });

      // Navigate to session
      router.push(`/session/${sessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">New Session</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Select a Repository</h2>
          <p className="text-sm text-text-secondary mt-1">
            Choose a repository to start a coding session
          </p>
        </div>

        {user.githubAccessToken ? (
          <RepoSelector
            githubToken={user.githubAccessToken}
            onSelect={handleSelectRepo}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-text-secondary">
              GitHub access token not found. Please sign out and sign in again.
            </p>
          </div>
        )}

        {isCreating && (
          <div className="fixed inset-0 bg-bg-primary/80 flex items-center justify-center z-50">
            <div className="bg-bg-elevated border border-border rounded-xl p-6 text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent mx-auto" />
              <p className="text-sm">Creating session...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
