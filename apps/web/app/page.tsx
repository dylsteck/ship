"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout";
import { RepoDropdown, BranchDropdown } from "@/components/repo-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
      const sessionId = await createSession({
        repoUrl: selectedRepo.cloneUrl,
        repoName: selectedRepo.fullName,
        branch: selectedBranch,
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          repoUrl: selectedRepo.cloneUrl,
          branch: selectedBranch,
          githubToken: currentUser?.githubAccessToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to create sandbox" }));
        console.error("Sandbox creation failed:", error);
        // Navigate anyway - the session page will show the error status
      }

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
        <div className="w-full max-w-2xl space-y-8">
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
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="p-5">
              <label className="block text-sm font-medium text-muted-foreground mb-3">
                What would you like to build?
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to accomplish..."
                className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Footer with submit */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {selectedRepo ? (
                  <>
                    <span className="font-medium text-foreground">{selectedRepo.fullName}</span>
                    {selectedBranch && <span> · {selectedBranch}</span>}
                  </>
                ) : (
                  "Select a repository to get started"
                )}
              </span>
              <Button
                onClick={handleStartSession}
                disabled={!selectedRepo || !selectedBranch || !prompt.trim() || isCreating}
                size="sm"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Starting...
                  </span>
                ) : (
                  <>
                    Start Session
                    <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      <span className="text-xs">⌘</span>↵
                    </kbd>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {quickActions.map((action) => (
              <Badge
                key={action.label}
                variant="outline"
                className="cursor-pointer hover:bg-accent transition-colors px-3 py-1.5"
                onClick={() => setPrompt(action.prompt)}
              >
                {action.label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
