"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, RepoIcon, GitBranchIcon, SearchIcon } from "@/components/ui/icons";

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

// Inline dropdown variants for the main page

interface RepoDropdownProps {
  repos: Repo[];
  selectedRepo: Repo | null;
  onSelect: (repo: Repo) => void;
  isLoading?: boolean;
}

export function RepoDropdown({ repos, selectedRepo, onSelect, isLoading }: RepoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-elevated text-sm hover:bg-hover-bg transition-colors min-w-[160px]",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        <RepoIcon className="h-4 w-4 text-text-secondary" />
        <span className="truncate flex-1 text-left">
          {isLoading ? "Loading..." : selectedRepo?.name || "Select repo"}
        </span>
        <ChevronDownIcon className={cn("h-4 w-4 text-text-secondary transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 max-h-80 rounded-lg border border-border bg-bg-elevated shadow-lg overflow-hidden z-50">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repos..."
                className="w-full h-8 pl-8 pr-3 rounded-md bg-bg-primary border border-border text-sm placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
            </div>
          </div>

          {/* Repo list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <div className="py-4 text-center text-sm text-text-secondary">
                No repos found
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    onSelect(repo);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-hover-bg transition-colors flex items-center gap-2",
                    selectedRepo?.id === repo.id && "bg-accent/10"
                  )}
                >
                  <RepoIcon className="h-4 w-4 text-text-secondary shrink-0" />
                  <span className="truncate">{repo.fullName}</span>
                  {repo.isPrivate && (
                    <span className="text-xs bg-bg-secondary px-1.5 py-0.5 rounded shrink-0">
                      Private
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface BranchDropdownProps {
  branches: Branch[];
  selectedBranch: string;
  onSelect: (branch: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function BranchDropdown({ branches, selectedBranch, onSelect, isLoading, disabled }: BranchDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-elevated text-sm hover:bg-hover-bg transition-colors min-w-[140px]",
          (isLoading || disabled) && "opacity-50 cursor-not-allowed"
        )}
      >
        <GitBranchIcon className="h-4 w-4 text-text-secondary" />
        <span className="truncate flex-1 text-left">
          {isLoading ? "Loading..." : selectedBranch || "Select branch"}
        </span>
        <ChevronDownIcon className={cn("h-4 w-4 text-text-secondary transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 max-h-60 rounded-lg border border-border bg-bg-elevated shadow-lg overflow-hidden z-50">
          <div className="max-h-60 overflow-y-auto">
            {branches.length === 0 ? (
              <div className="py-4 text-center text-sm text-text-secondary">
                No branches found
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => {
                    onSelect(branch.name);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-hover-bg transition-colors flex items-center gap-2",
                    selectedBranch === branch.name && "bg-accent/10"
                  )}
                >
                  <GitBranchIcon className="h-4 w-4 text-text-secondary shrink-0" />
                  <span className="truncate">{branch.name}</span>
                  {branch.protected && (
                    <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded shrink-0">
                      Protected
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
