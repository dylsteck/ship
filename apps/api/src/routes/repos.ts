import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  description: string | null;
  language: string | null;
  updated_at: string;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export function createRepoRoutes() {
  const app = new Hono();

  // List user's repositories
  app.get(
    "/",
    zValidator(
      "query",
      z.object({
        githubToken: z.string(),
        page: z.string().optional().default("1"),
        per_page: z.string().optional().default("30"),
        sort: z.enum(["updated", "created", "pushed", "full_name"]).optional().default("updated"),
      })
    ),
    async (c) => {
      const { githubToken, page, per_page, sort } = c.req.valid("query");

      try {
        const response = await fetch(
          `https://api.github.com/user/repos?page=${page}&per_page=${per_page}&sort=${sort}&affiliation=owner,collaborator`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return c.json({ error: `GitHub API error: ${error}` }, response.status as any);
        }

        const repos: GitHubRepo[] = await response.json();

        return c.json({
          repos: repos.map((repo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            defaultBranch: repo.default_branch,
            isPrivate: repo.private,
            description: repo.description,
            language: repo.language,
            updatedAt: repo.updated_at,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 500);
      }
    }
  );

  // Get branches for a repository
  app.get(
    "/:owner/:repo/branches",
    zValidator(
      "query",
      z.object({
        githubToken: z.string(),
      })
    ),
    async (c) => {
      const owner = c.req.param("owner");
      const repo = c.req.param("repo");
      const { githubToken } = c.req.valid("query");

      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return c.json({ error: `GitHub API error: ${error}` }, response.status as any);
        }

        const branches: GitHubBranch[] = await response.json();

        return c.json({
          branches: branches.map((branch) => ({
            name: branch.name,
            protected: branch.protected,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 500);
      }
    }
  );

  // Search repositories
  app.get(
    "/search",
    zValidator(
      "query",
      z.object({
        githubToken: z.string(),
        q: z.string(),
      })
    ),
    async (c) => {
      const { githubToken, q } = c.req.valid("query");

      try {
        // Search in user's repos
        const response = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+user:@me&sort=updated&per_page=20`,
          {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          return c.json({ error: `GitHub API error: ${error}` }, response.status as any);
        }

        const data = await response.json();

        return c.json({
          repos: data.items.map((repo: GitHubRepo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            htmlUrl: repo.html_url,
            cloneUrl: repo.clone_url,
            defaultBranch: repo.default_branch,
            isPrivate: repo.private,
            description: repo.description,
            language: repo.language,
            updatedAt: repo.updated_at,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return c.json({ error: message }, 500);
      }
    }
  );

  return app;
}
