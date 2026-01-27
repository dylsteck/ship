"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@ship/convex/convex/_generated/api";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout";
import { StatsCards } from "@/components/dashboard";
import { RepoDropdown, BranchDropdown } from "@/components/repo-selector";
import { Button } from "@/components/ui/button";
import { CpuIcon, ChevronDownIcon, SendIcon } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const MODELS = [
  { id: "claude-opus-4.5", name: "Claude Opus 4.5", description: "Most capable" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Fast & capable" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const currentUser = useQuery(api.users.current);
  const sessions = useQuery(api.sessions.list, {});
  const createSession = useMutation(api.sessions.create);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]>(MODELS[0]);
  const [prompt, setPrompt] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate stats from sessions
  const stats = {
    sessionCount: sessions?.length || 0,
    activeUsers: 1, // In real app, this would come from analytics
    promptCount: sessions?.filter(s => {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return s.updatedAt > dayAgo;
    }).length || 0,
  };

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

  return (
    <AppShell showDashboardLink={false}>
      <div className="flex-1 flex flex-col">
        {/* Main content area */}
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

            {/* Main prompt input - Ramp style */}
            <div className="relative rounded-xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-ring transition-all">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask or build anything"
                rows={3}
                className={cn(
                  "w-full resize-none bg-transparent",
                  "px-4 pt-4 pb-14 text-base placeholder:text-muted-foreground",
                  "focus:outline-none",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              />

              {/* Bottom toolbar */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                {/* Model selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <CpuIcon className="h-3.5 w-3.5" />
                      <span className="font-mono lowercase">{selectedModel.name.toLowerCase()}</span>
                      <ChevronDownIcon className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {MODELS.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => setSelectedModel(model)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Right side - build agent toggle and send */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">build agent</span>
                  <Button
                    onClick={handleStartSession}
                    disabled={!selectedRepo || !selectedBranch || !prompt.trim() || isCreating}
                    size="sm"
                    className="h-7 w-7 p-0"
                  >
                    {isCreating ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    ) : (
                      <SendIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <StatsCards
              sessionCount={stats.sessionCount}
              activeUsers={stats.activeUsers}
              promptCount={stats.promptCount}
            />

            {/* Live indicator */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                {sessions?.filter(s => s.status === "running" || s.status === "idle").length || 0} active sessions
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
