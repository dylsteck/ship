"use client";

import { useState, useEffect } from "react";
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

interface RepoSelectorProps {
  githubToken: string;
  onSelect: (repo: Repo, branch: string) => void;
}

export function RepoSelector({ githubToken, onSelect }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Fetch repos on mount
  useEffect(() => {
    async function fetchRepos() {
      setIsLoadingRepos(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${apiUrl}/repos?githubToken=${encodeURIComponent(githubToken)}`
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
  }, [githubToken]);

  // Fetch branches when repo is selected
  useEffect(() => {
    if (!selectedRepo) {
      setBranches([]);
      return;
    }

    async function fetchBranches() {
      if (!selectedRepo) return;
      setIsLoadingBranches(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const [owner, repo] = selectedRepo.fullName.split("/");
        const response = await fetch(
          `${apiUrl}/repos/${owner}/${repo}/branches?githubToken=${encodeURIComponent(githubToken)}`
        );
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches);
          setSelectedBranch(selectedRepo.defaultBranch);
        }
      } catch (error) {
        console.error("Failed to fetch branches:", error);
      } finally {
        setIsLoadingBranches(false);
      }
    }
    fetchBranches();
  }, [selectedRepo, githubToken]);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = () => {
    if (selectedRepo && selectedBranch) {
      onSelect(selectedRepo, selectedBranch);
    }
  };

  return (
    <div className="space-y-6">
      {/* Repository Search */}
      <div>
        <label className="block text-sm font-medium mb-2">Repository</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search repositories..."
          className="w-full rounded-lg bg-bg-elevated border border-border px-4 py-2.5 text-sm placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
        />
      </div>

      {/* Repository List */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
        {isLoadingRepos ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            No repositories found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRepos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => setSelectedRepo(repo)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  selectedRepo?.id === repo.id
                    ? "bg-accent/10"
                    : "hover:bg-bg-secondary"
                )}
              >
                <div className="flex items-center gap-2">
                  <RepoIcon className="h-4 w-4 text-text-secondary shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {repo.fullName}
                  </span>
                  {repo.isPrivate && (
                    <span className="text-xs bg-bg-secondary px-1.5 py-0.5 rounded">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-text-secondary mt-1 truncate">
                    {repo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {repo.language && (
                    <span className="text-xs text-text-secondary">
                      {repo.language}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Branch Selector */}
      {selectedRepo && (
        <div>
          <label className="block text-sm font-medium mb-2">Branch</label>
          {isLoadingBranches ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
              Loading branches...
            </div>
          ) : (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full rounded-lg bg-bg-elevated border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.protected && " (protected)"}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedRepo || !selectedBranch}
        className={cn(
          "w-full rounded-lg py-3 font-medium text-sm transition-colors",
          "bg-accent text-white",
          "hover:bg-accent/90",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-accent/50"
        )}
      >
        Start Session
      </button>
    </div>
  );
}

function RepoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 22v-4a4.8 4.8 0 00-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 004 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
