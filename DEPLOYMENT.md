# Deployment Guide

Complete guide for deploying Ship to production.

## Prerequisites

- Cloudflare account (free tier works)
- GitHub account (for OAuth)
- All API keys ready (Anthropic, E2B, etc.)

## Deploy Cloudflare Worker API

### Step 1: Create Production D1 Database

```bash
cd apps/api
npx wrangler d1 create ship-db-production
```

**Important:** Copy the `database_id` from the output.

### Step 2: Update Production Database ID

Edit `apps/api/wrangler.toml`:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "ship-db"
database_id = "your-production-database-id-here"  # Replace "TBD"
```

### Step 3: Run Production Migrations

```bash
cd apps/api
npx wrangler d1 execute ship-db --file=src/db/schema.sql
```

**Note:** This runs against the production database (not `--local`). Make sure you're deploying to the right database!

### Step 4: Set Production Secrets

Set each secret interactively (Wrangler will prompt for the value):

```bash
cd apps/api

# Required secrets
npx wrangler secret put API_SECRET
npx wrangler secret put E2B_API_KEY

# Optional secrets (if using these features)
npx wrangler secret put ANTHROPIC_API_KEY
```

**Tip:** You can also set secrets non-interactively:
```bash
echo "your-secret-value" | npx wrangler secret put API_SECRET
```

### Step 5: Deploy to Production

```bash
cd apps/api
npx wrangler deploy --env production
```

Or deploy to default (if production is your default):

```bash
npx wrangler deploy
```

**Output:** You'll get a URL like `https://ship-api-production.your-subdomain.workers.dev`

### Step 6: Verify Deployment

1. Check health endpoint:
   ```bash
   curl https://ship-api-production.your-subdomain.workers.dev/health
   ```
   Should return: `{"status":"ok","timestamp":...}`

2. Check logs:
   ```bash
   npx wrangler tail --env production
   ```

## Deploy Next.js Web App

### Option 1: Deploy to Vercel (Recommended)

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Project:**
   - **Root Directory:** Set to `apps/web`
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `pnpm build` (or leave default)
   - **Output Directory:** `.next` (default)

3. **Set Environment Variables:**
   Add all variables from `apps/web/.env.example`:
   ```
   GITHUB_CLIENT_ID=your-production-github-client-id
   GITHUB_CLIENT_SECRET=your-production-github-client-secret
   SESSION_SECRET=your-production-session-secret
   API_BASE_URL=https://ship-api-production.your-subdomain.workers.dev
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   LINEAR_CLIENT_ID=your-linear-client-id (optional)
   LINEAR_CLIENT_SECRET=your-linear-client-secret (optional)
   ```

4. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Option 2: Deploy to Cloudflare Pages

```bash
cd apps/web

# Build the app
pnpm build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .next --project-name=ship-web
```

Set environment variables in Cloudflare Dashboard:
- Go to Pages → Your Project → Settings → Environment Variables
- Add all variables from `.env.example`

## Post-Deployment Checklist

### 1. Update GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Edit your OAuth App
3. Update **Authorization callback URL** to:
   ```
   https://your-app.vercel.app/api/auth/github/callback
   ```
4. Update **Homepage URL** to:
   ```
   https://your-app.vercel.app
   ```

### 2. Update Linear OAuth App (if using)

1. Go to [linear.app/settings/api](https://linear.app/settings/api)
2. Edit your OAuth app
3. Update **Redirect URL** to:
   ```
   https://your-app.vercel.app/api/auth/linear/callback
   ```

### 3. Update Web App Environment Variables

Make sure `API_BASE_URL` points to your production Worker:
```env
API_BASE_URL=https://ship-api-production.your-subdomain.workers.dev
```

### 4. Test Production Deployment

1. **Test Authentication:**
   - Visit `https://your-app.vercel.app`
   - Click "Sign in with GitHub"
   - Complete OAuth flow
   - Verify you're logged in

2. **Test API:**
   ```bash
   curl https://ship-api-production.your-subdomain.workers.dev/health
   ```

3. **Test Database:**
   ```bash
   cd apps/api
   npx wrangler d1 execute ship-db --command="SELECT COUNT(*) FROM users"
   ```

## Staging Environment (Optional)

To set up a staging environment:

### 1. Create Staging Database

```bash
cd apps/api
npx wrangler d1 create ship-db-staging
```

### 2. Update wrangler.toml

```toml
[[env.staging.d1_databases]]
binding = "DB"
database_name = "ship-db-staging"
database_id = "your-staging-database-id"
```

### 3. Deploy to Staging

```bash
cd apps/api
npx wrangler deploy --env staging
```

### 4. Set Staging Secrets

```bash
npx wrangler secret put API_SECRET --env staging
npx wrangler secret put E2B_API_KEY --env staging
# etc.
```

## Environment-Specific Configuration

### Production Environment Variables

**Worker (`wrangler.toml`):**
```toml
[env.production]
name = "ship-api-production"
vars = { ENVIRONMENT = "production" }
```

**Web App (Vercel/Cloudflare Pages):**
```env
ENVIRONMENT=production
API_BASE_URL=https://ship-api-production.your-subdomain.workers.dev
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Staging Environment Variables

**Worker:**
```toml
[env.staging]
name = "ship-api-staging"
vars = { ENVIRONMENT = "staging" }
```

**Web App:**
```env
ENVIRONMENT=staging
API_BASE_URL=https://ship-api-staging.your-subdomain.workers.dev
NEXT_PUBLIC_APP_URL=https://your-app-staging.vercel.app
```

## Troubleshooting

### Worker Deployment Fails

1. **Check Wrangler version:**
   ```bash
   npx wrangler --version
   ```
   Update if needed: `pnpm add -D wrangler@latest`

2. **Check authentication:**
   ```bash
   npx wrangler whoami
   ```
   Login if needed: `npx wrangler login`

3. **Check database exists:**
   ```bash
   npx wrangler d1 list
   ```

### Secrets Not Working

1. **Verify secrets are set:**
   ```bash
   npx wrangler secret list --env production
   ```

2. **Re-set secret if needed:**
   ```bash
   npx wrangler secret put SECRET_NAME --env production
   ```

### Database Migration Issues

1. **Check migration file exists:**
   ```bash
   ls -la apps/api/src/db/schema.sql
   ```

2. **Test migration locally first:**
   ```bash
   npx wrangler d1 execute ship-db --local --file=src/db/schema.sql
   ```

3. **Run production migration:**
   ```bash
   npx wrangler d1 execute ship-db --file=src/db/schema.sql
   ```

### CORS Issues

If you see CORS errors, check:
1. `API_BASE_URL` in web app matches Worker URL exactly
2. Worker CORS configuration allows your domain
3. Check Worker logs: `npx wrangler tail --env production`

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: cd apps/api && npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: cd apps/web && pnpm build
      # Add Vercel deployment step here
```

## Monitoring & Logs

### View Worker Logs

```bash
# Real-time logs (production)
npx wrangler tail ship-api-production

# Alternative (if using env flag)
npx wrangler tail --env production

# Filter logs with formatting
npx wrangler tail ship-api-production --format=pretty
```

**Tip:** Use `npx wrangler tail ship-api-production` to debug production issues. Look for logs prefixed with `[chat:...]`, `[opencode:...]`, and `[opencode:prompt]` to track agent execution flow.

### View Database Queries

```bash
# Query production database
npx wrangler d1 execute ship-db --command="SELECT * FROM users LIMIT 10"

# Check table schema
npx wrangler d1 execute ship-db --command="SELECT sql FROM sqlite_master WHERE type='table'"
```

### Monitor in Cloudflare Dashboard

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → Your Worker
3. View metrics, logs, and analytics

## Rollback

If something goes wrong:

### Rollback Worker

```bash
# List deployments
npx wrangler deployments list --env production

# Rollback to previous version
npx wrangler rollback --env production
```

### Rollback Database

⚠️ **Warning:** D1 doesn't have built-in rollback. You'll need to:
1. Create a new migration to undo changes
2. Or restore from backup (if you have one)

## Security Checklist

- [ ] All secrets set via `wrangler secret put` (not in code)
- [ ] `.dev.vars` is in `.gitignore`
- [ ] Production database ID is correct
- [ ] OAuth callback URLs updated for production
- [ ] CORS configured correctly
- [ ] Environment variables set in Vercel/Cloudflare Pages
- [ ] Session secret is strong (32+ characters)
- [ ] API secret is different from session secret

## Next Steps

After deployment:
1. Test all authentication flows
2. Test agent operations (if using)
3. Monitor logs for errors
4. Set up alerts (optional)
5. Document your production URLs

## Reference

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Vercel Deployment Docs](https://vercel.com/docs)
