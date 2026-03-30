# Vercel Deployment Setup Instructions

The Vercel Preview Deployment workflow requires three GitHub secrets to be configured.

## Required Secrets

Add these secrets in your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### 1. VERCEL_TOKEN
Your Vercel API token for authentication.

**How to get it:**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token
5. Add it as `VERCEL_TOKEN` in GitHub secrets

### 2. VERCEL_ORG_ID
Your Vercel organization/team ID.

**How to get it:**
1. Run `vercel link` in the `novaRewards/frontend` directory
2. Follow the prompts to link your project
3. Open `.vercel/project.json`
4. Copy the `orgId` value
5. Add it as `VERCEL_ORG_ID` in GitHub secrets

### 3. VERCEL_PROJECT_ID
Your Vercel project ID.

**How to get it:**
1. Same as above - run `vercel link` if you haven't
2. Open `.vercel/project.json`
3. Copy the `projectId` value
4. Add it as `VERCEL_PROJECT_ID` in GitHub secrets

## Alternative: Using Vercel CLI

```bash
cd novaRewards/frontend
vercel link
cat .vercel/project.json
```

The output will show both `orgId` and `projectId`.

## Workflow File

The workflow is configured in `.github/workflows/vercel-preview.yml`

Once all three secrets are added, the Vercel preview deployment will work automatically on pull requests.
