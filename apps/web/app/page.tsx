"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout";
import { RepoDropdown, BranchDropdown } from "@/components/repo-selector";
import { cn } from "@/lib/utils";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  language: string | null;
  updatedAt: string;
}

interface Branch {
  name: string;
  protected: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.current);
  const createSession = useMutation(api.sessions.create);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch repos when we have the token
  useEffect(() => {
    if (!currentUser?.githubAccessToken) return;

    async function fetchRepos() {
      setIsLoadingRepos(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${apiUrl}/repos?githubToken=${encodeURIComponent(currentUser!.githubAccessToken!)}`
        );
        if (response.ok) {
          const data = await response.json();
          setRepos(data.repos);
        }
      } catch (error) {
        console.error("Failed to fetch repos:", error);
      } finally {
        setIsLoadingRepos(false);
      }
    }
    fetchRepos();
  }, [currentUser?.githubAccessToken]);

  // Fetch branches when repo changes
  useEffect(() => {
    if (!selectedRepo || !currentUser?.githubAccessToken) {
      setBranches([]);
      setSelectedBranch("");
      return;
    }

    async function fetchBranches() {
      setIsLoadingBranches(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const [owner, repo] = selectedRepo!.fullName.split("/");
        const response = await fetch(
          `${apiUrl}/repos/${owner}/${repo}/branches?githubToken=${encodeURIComponent(currentUser!.githubAccessToken!)}`
        );
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches);
          setSelectedBranch(selectedRepo!.defaultBranch);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setIsLoadingBranches(false);
      }
    }
    fetchBranches();
  }, [selectedRepo, currentUser?.githubAccessToken]);

  const handleStartSession = async () => {
    if (!selectedRepo || !selectedBranch || !prompt.trim()) return;

    setIsCreating(true);
    try {
      // Create session in Convex
      const sessionId = await createSession({
        repoUrl: selectedRepo.cloneUrl,
        repoName: selectedRepo.fullName,
        branch: selectedBranch,
      });

      // Trigger sandbox creation
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      await fetch(`${apiUrl}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          repoUrl: selectedRepo.cloneUrl,
          branch: selectedBranch,
          githubToken: currentUser?.githubAccessToken,
        }),
      });

      // Navigate to session with the initial prompt
      router.push(`/session/${sessionId}?prompt=${encodeURIComponent(prompt.trim())}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleStartSession();
    }
  };

  const quickActions = [
    { label: "Fix a bug", prompt: "Help me fix a bug in this codebase" },
    { label: "Add tests", prompt: "Help me add tests for this codebase" },
    { label: "Refactor", prompt: "Help me refactor and improve this code" },
    { label: "Add feature", prompt: "Help me add a new feature" },
  ];

  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Repo/Branch selectors */}
          <div className="flex items-center justify-center gap-3">
            <RepoDropdown
              repos={repos}
              selectedRepo={selectedRepo}
              onSelect={setSelectedRepo}
              isLoading={isLoadingRepos}
            />
            <BranchDropdown
              branches={branches}
              selectedBranch={selectedBranch}
              onSelect={setSelectedBranch}
              isLoading={isLoadingBranches}
              disabled={!selectedRepo}
            />
          </div>

          {/* Main prompt area */}
          <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
            <div className="p-4">
              <label className="block text-sm text-text-secondary mb-2">
                What would you like to build?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to accomplish..."
                className="w-full h-32 bg-transparent text-text-primary placeholder:text-text-secondary/50 text-sm resize-none focus:outline-none"
              />
            </div>

            {/* Footer with submit */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-bg-secondary/50">
              <span className="text-xs text-text-secondary">
                {selectedRepo ? (
                  <>
                    {selectedRepo.fullName}
                    {selectedBranch && ` · ${selectedBranch}`}
                  </>
                ) : (
                  "Select a repository to get started"
                )}
              </span>
              <button
                onClick={handleStartSession}
                disabled={!selectedRepo || !selectedBranch || !prompt.trim() || isCreating}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-accent text-white hover:bg-accent/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Starting...
                  </span>
                ) : (
                  <>
                    Start Session
                    <span className="ml-2 text-xs opacity-70">⌘↵</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => setPrompt(action.prompt)}
                className="px-3 py-1.5 rounded-full border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-hover-bg transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
