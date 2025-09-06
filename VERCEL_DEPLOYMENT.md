# ContactGate Vercel Deployment Guide

## Step 1: Import from GitHub to Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repository: `speudoname/contactgate`
3. Configure project settings:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: `next build` (default)
   - Output Directory: `.next` (default)

## Step 2: Environment Variables

Add these environment variables in Vercel project settings:

```bash
# Supabase Configuration (SAME AS NUMGATE)
NEXT_PUBLIC_SUPABASE_URL=https://hbopxprpgvrkucztsvnq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMTg1MzksImV4cCI6MjA3MjU5NDUzOX0.XPdDW2RwLBQZaQOtgCicUXFO5-7R4EeqpXFlHwQLZ7k
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhib3B4cHJwZ3Zya3VjenRzdm5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzAxODUzOSwiZXhwIjoyMDcyNTk0NTM5fQ.dZRhMWMIZdHOzgQ5CMVW1jxNew4tT2dvUnQbjSi9uc4

# JWT Configuration (MUST MATCH NUMGATE)
JWT_SECRET=E5q8Ta2a5trFFtfL7MaIlLUr9OKAFaoXFXKB88Jnt6I=

# Application URLs
NEXT_PUBLIC_APP_URL=https://contactgate.vercel.app
NEXT_PUBLIC_GATEWAY_URL=https://numgate.vercel.app

# Environment
NODE_ENV=production
```

## Step 3: Update NumGate Environment Variables

After ContactGate is deployed, update these in NumGate's Vercel project:

```bash
NEXT_PUBLIC_CONTACTGATE_URL=https://contactgate.vercel.app
CONTACTGATE_URL=https://contactgate.vercel.app
```

## Step 4: Verify Deployment

1. ContactGate should be accessible at: https://contactgate.vercel.app
2. Test from NumGate dashboard: Click "Contact Management" app
3. Verify JWT token is passed correctly
4. Check that tenant isolation works

## Important Notes

- **Auto-deployment**: Once connected, every push to GitHub main branch will auto-deploy
- **Domain**: You can add a custom domain later if needed
- **Database**: Uses same Supabase instance as NumGate (no separate setup needed)
- **JWT Secret**: MUST be identical to NumGate's JWT_SECRET

## Troubleshooting

If ContactGate doesn't load from NumGate:
1. Check browser console for CORS errors
2. Verify JWT_SECRET matches exactly
3. Check that environment variables are set in Vercel
4. Ensure ContactGate URL is correct in NumGate's env vars